import { and, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx, Tx } from "@/db/client";
import {
  bookings,
  categories,
  contractAcceptances,
  contracts,
  giveawayClaims,
  legalDocumentVersions,
  listings,
  users,
  type ContractKind,
  type PartyRole,
} from "@/db/schema";
import { formatDate } from "@/i18n/format";
import { AppError } from "@/modules/errors";
import { renderContract } from "./render";
import { DEADLINES, platformId, type ContractTerms, type GiveawayTerms, type RentalTerms } from "./terms";

/** Current template version (Norwegian is authoritative; English is rendered for information only). */
export async function loadTemplate(db: DbOrTx, kind: ContractKind, locale: "nb" | "en" = "nb") {
  const [row] = await db
    .select()
    .from(legalDocumentVersions)
    .where(and(eq(legalDocumentVersions.docKey, kind), eq(legalDocumentVersions.locale, locale)))
    .orderBy(desc(legalDocumentVersions.createdAt))
    .limit(1);
  return row ?? null;
}

/** LA-2026-000123 (rental) / GB-2026-000007 (giveaway), from a database sequence. */
async function nextAgreementNumber(tx: Tx, prefix: "LA" | "GB"): Promise<string> {
  const [{ n }] = (await tx.execute<{ n: string }>(sql`SELECT nextval('agreement_number_seq')::text AS n`)).rows as [
    { n: string },
  ];
  return `${prefix}-${new Date().getUTCFullYear()}-${n.padStart(6, "0")}`;
}

async function party(tx: Tx, userId: string) {
  const [u] = await tx.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("not_found");
  return { userId: u.id, displayName: u.name, platformId: platformId(u.id) };
}

/**
 * Agreement A for a booking (RENTAL_AGREEMENTS §3): built from the booking snapshot and the listing,
 * rendered once, stored with its hash. A new revision keeps the agreement number of revision 1.
 */
export async function createRentalContract(tx: Tx, bookingId: string): Promise<{ id: string; sha256: string }> {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!b) throw new AppError("not_found");
  const [l] = await tx.select().from(listings).where(eq(listings.id, b.listingId));
  const [c] = await tx.select().from(categories).where(eq(categories.id, l!.categoryId));
  const template = await loadTemplate(tx, "rental_simple");
  if (!template) throw new AppError("feature_disabled", "agreement_template_missing");

  const previous = await tx
    .select({ revision: contracts.revision, number: contracts.agreementNumber })
    .from(contracts)
    .where(eq(contracts.bookingId, bookingId))
    .orderBy(desc(contracts.revision))
    .limit(1);
  const revision = (previous[0]?.revision ?? 0) + 1;
  const baseNumber = previous[0]?.number.replace(/-v\d+$/, "") ?? (await nextAgreementNumber(tx, "LA"));
  const { lower, upper } = (
    await tx.execute<{ lower: Date; upper: Date }>(
      sql`SELECT lower(${bookings.period}) AS lower, upper(${bookings.period}) AS upper FROM ${bookings} WHERE ${bookings.id} = ${bookingId}`,
    )
  ).rows[0]!;

  const terms: RentalTerms = {
    kind: "rental_simple",
    agreementNumber: baseNumber,
    templateVersion: template.version,
    revision,
    owner: await party(tx, b.ownerId),
    renter: await party(tx, b.renterId),
    item: {
      title: l!.title,
      description: l!.description,
      categoryLabelNb: c!.labels.nb,
      categoryLabelEn: c!.labels.en,
      condition: l!.itemCondition,
      knownDefects: l!.knownDefects,
    },
    declaredValueOre: b.declaredValueOre,
    price: { amountOre: b.priceOre, unit: b.priceUnit, units: b.units, totalOre: b.totalPriceOre },
    period: { start: new Date(lower).toISOString(), end: new Date(upper).toISOString() },
    handover: { method: b.handoverMethod, deliveryFeeOre: b.deliveryFeeOre },
    return: { method: b.returnMethod },
    accessories: l!.includedAccessories ?? [],
    depositOre: b.depositOre,
    permittedUse: l!.usageRestrictions,
    operatingInstructions: l!.operatingInstructions,
    safetyNoticeNb: c!.policy === "restricted" ? (c!.safetyNotice?.nb ?? null) : null,
    safetyNoticeEn: c!.policy === "restricted" ? (c!.safetyNotice?.en ?? null) : null,
    deadlines: DEADLINES,
  };
  return insertContract(tx, {
    kind: "rental_simple",
    bookingId,
    templateVersionId: template.id,
    number: revision === 1 ? baseNumber : `${baseNumber}-v${revision}`,
    revision,
    terms,
    templateMd: template.contentMd,
  });
}

/** The «Gis bort» transfer confirmation (RENTAL_AGREEMENTS §7). */
export async function createGiveawayContract(tx: Tx, claimId: string): Promise<{ id: string; sha256: string }> {
  const [g] = await tx.select().from(giveawayClaims).where(eq(giveawayClaims.id, claimId));
  if (!g) throw new AppError("not_found");
  const [l] = await tx.select().from(listings).where(eq(listings.id, g.listingId));
  const template = await loadTemplate(tx, "giveaway_transfer");
  if (!template) throw new AppError("feature_disabled", "agreement_template_missing");
  const number = await nextAgreementNumber(tx, "GB");
  const terms: GiveawayTerms = {
    kind: "giveaway_transfer",
    agreementNumber: number,
    templateVersion: template.version,
    revision: 1,
    giver: await party(tx, g.giverId),
    recipient: await party(tx, g.claimantId),
    item: { title: l!.title, description: l!.description, condition: l!.itemCondition, knownDefects: l!.knownDefects },
    handover: { method: g.handoverMethod, date: formatDate(new Date()) },
  };
  return insertContract(tx, {
    kind: "giveaway_transfer",
    giveawayClaimId: claimId,
    templateVersionId: template.id,
    number,
    revision: 1,
    terms,
    templateMd: template.contentMd,
  });
}

async function insertContract(
  tx: Tx,
  c: {
    kind: ContractKind;
    bookingId?: string;
    giveawayClaimId?: string;
    templateVersionId: string;
    number: string;
    revision: number;
    terms: ContractTerms;
    templateMd: string;
  },
) {
  const { text, sha256 } = renderContract(c.templateMd, c.terms, "nb");
  const [row] = await tx
    .insert(contracts)
    .values({
      kind: c.kind,
      bookingId: c.bookingId ?? null,
      giveawayClaimId: c.giveawayClaimId ?? null,
      templateVersionId: c.templateVersionId,
      agreementNumber: c.number,
      revision: c.revision,
      terms: c.terms as unknown as Record<string, unknown>,
      renderedText: text,
      renderedSha256: sha256,
    })
    .returning({ id: contracts.id });
  return { id: row!.id, sha256 };
}

/** Marks the live contract of a booking or claim as superseded (new revision) or void (cancelled/expired). */
export async function closeLiveContract(
  tx: Tx,
  where: { bookingId?: string; claimId?: string },
  status: "superseded" | "void",
) {
  const cond = where.bookingId
    ? eq(contracts.bookingId, where.bookingId)
    : eq(contracts.giveawayClaimId, where.claimId!);
  await tx
    .update(contracts)
    .set({ status, supersededAt: new Date() })
    .where(and(cond, sql`${contracts.status} IN ('pending_acceptance','accepted')`));
}

/**
 * Records one party's acceptance of the exact text it was shown (hash), after the caller has checked
 * that the actor is that party. Returns the roles that have accepted so far.
 */
export async function recordAcceptance(
  tx: Tx,
  contractId: string,
  userId: string,
  role: PartyRole,
  shownSha256: string,
): Promise<PartyRole[]> {
  const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).for("update");
  if (!c) throw new AppError("not_found");
  if (c.status !== "pending_acceptance") throw new AppError("conflict", "agreement_not_open");
  if (c.renderedSha256 !== shownSha256) throw new AppError("conflict", "agreement_changed");
  await tx
    .insert(contractAcceptances)
    .values({ contractId, userId, partyRole: role, acceptedSha256: shownSha256 })
    .onConflictDoNothing();
  const rows = await tx
    .select({ role: contractAcceptances.partyRole })
    .from(contractAcceptances)
    .where(eq(contractAcceptances.contractId, contractId));
  return rows.map((r) => r.role);
}

export async function markContractAccepted(tx: Tx, contractId: string) {
  await tx
    .update(contracts)
    .set({ status: "accepted" })
    .where(and(eq(contracts.id, contractId), eq(contracts.status, "pending_acceptance")));
}
