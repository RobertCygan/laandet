import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  bookingEvents,
  bookings,
  conditionConfirmations,
  conditionEntries,
  conditionPhotos,
  conditionReports,
  contractAcceptances,
  contracts,
  disputes,
  giveawayClaims,
  legalDocumentVersions,
  listings,
  users,
  type BookingStatus,
  type ClaimStatus,
  type ContractKind,
  type ReportPhase,
} from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { can } from "@/modules/authz/policy";
import { CONDITION_DEADLINES, decisions } from "@/modules/condition/service";
import { renderContract } from "@/modules/contracts/render";
import { loadTemplate } from "@/modules/contracts/service";
import type { ContractTerms } from "@/modules/contracts/terms";
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from "./state";

/**
 * Read models for the Phase 02 pages. Everything is scoped to the two parties: a wrong id or a
 * stranger gets `null` (the page shows 404).
 */
const otherUser = alias(users, "other_user");
const period = {
  start: sql<Date>`lower(${bookings.period})`.mapWith((v) => new Date(v as string)),
  end: sql<Date>`upper(${bookings.period})`.mapWith((v) => new Date(v as string)),
};

export type MyBooking = {
  id: string;
  status: BookingStatus;
  role: "owner" | "renter";
  title: string;
  otherName: string;
  start: Date;
  end: Date;
  totalPriceOre: number;
};

export type MyClaim = {
  id: string;
  status: ClaimStatus;
  role: "giver" | "recipient";
  title: string;
  otherName: string;
  createdAt: Date;
};

/** «Mine leieforhold»: bookings as renter and as owner, grouped, plus giveaways in progress. */
export async function listMyBookings(actor: Actor) {
  if (actor.kind !== "user") return null;
  const me = actor.id;
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      ownerId: bookings.ownerId,
      title: listings.title,
      otherName: otherUser.name,
      totalPriceOre: bookings.totalPriceOre,
      ...period,
    })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .innerJoin(
      otherUser,
      sql`${otherUser.id} = CASE WHEN ${bookings.ownerId} = ${me} THEN ${bookings.renterId} ELSE ${bookings.ownerId} END`,
    )
    .where(or(eq(bookings.ownerId, me), eq(bookings.renterId, me)))
    .orderBy(desc(bookings.updatedAt))
    .limit(200);
  const list: MyBooking[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    role: r.ownerId === me ? "owner" : "renter",
    title: r.title,
    otherName: r.otherName,
    start: r.start,
    end: r.end,
    totalPriceOre: Number(r.totalPriceOre),
  }));

  const claimRows = await db
    .select({
      id: giveawayClaims.id,
      status: giveawayClaims.status,
      giverId: giveawayClaims.giverId,
      title: listings.title,
      otherName: otherUser.name,
      createdAt: giveawayClaims.createdAt,
    })
    .from(giveawayClaims)
    .innerJoin(listings, eq(listings.id, giveawayClaims.listingId))
    .innerJoin(
      otherUser,
      sql`${otherUser.id} = CASE WHEN ${giveawayClaims.giverId} = ${me} THEN ${giveawayClaims.claimantId} ELSE ${giveawayClaims.giverId} END`,
    )
    .where(or(eq(giveawayClaims.giverId, me), eq(giveawayClaims.claimantId, me)))
    .orderBy(desc(giveawayClaims.updatedAt))
    .limit(200);
  const claims: MyClaim[] = claimRows.map((r) => ({
    id: r.id,
    status: r.status,
    role: r.giverId === me ? "giver" : "recipient",
    title: r.title,
    otherName: r.otherName,
    createdAt: r.createdAt,
  }));

  return {
    active: list.filter((b) => !TERMINAL_STATUSES.includes(b.status) && b.status !== "requested"),
    requests: list.filter((b) => b.status === "requested"),
    finished: list.filter((b) => TERMINAL_STATUSES.includes(b.status)),
    claims,
  };
}

/** Everything the booking page needs, for one of the two parties only. */
export async function getBookingForParty(actor: Actor, bookingId: string, now = new Date()) {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const [b] = await db
    .select({
      booking: bookings,
      title: listings.title,
      listingStatus: listings.status,
      pickup: listings.handoverPickup,
      delivery: listings.handoverOwnerDelivery,
      meet: listings.handoverMeet,
      accessories: listings.includedAccessories,
      ...period,
    })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(eq(bookings.id, bookingId));
  if (!b) return null;
  if (!can(actor, "booking.view", { type: "booking", ownerId: b.booking.ownerId, renterId: b.booking.renterId }).allow)
    return null;
  const me = (actor as { id: string }).id;
  const role: "owner" | "renter" = b.booking.ownerId === me ? "owner" : "renter";
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, [b.booking.ownerId, b.booking.renterId]));
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "";

  const [events, allContracts, reports, dispute] = await Promise.all([
    db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId)).orderBy(asc(bookingEvents.createdAt)),
    db.select().from(contracts).where(eq(contracts.bookingId, bookingId)).orderBy(desc(contracts.revision)),
    db.select().from(conditionReports).where(eq(conditionReports.bookingId, bookingId)),
    db
      .select({ id: disputes.id, status: disputes.status })
      .from(disputes)
      .where(eq(disputes.bookingId, bookingId))
      .orderBy(desc(disputes.openedAt))
      .limit(1),
  ]);
  const live = allContracts.find((c) => c.status === "pending_acceptance" || c.status === "accepted") ?? null;
  const acceptances = live
    ? await db.select().from(contractAcceptances).where(eq(contractAcceptances.contractId, live.id))
    : [];
  const shown = live ?? allContracts[0] ?? null;
  const HOUR = 60 * 60 * 1000;

  return {
    booking: b.booking,
    methods: [
      ...(b.pickup ? (["pickup"] as const) : []),
      ...(b.delivery ? (["owner_delivery"] as const) : []),
      ...(b.meet ? (["meet"] as const) : []),
    ],
    accessories: b.accessories ?? [],
    /** Handover entries open 48 h before the start; «Ikke tilbakelevert» 24 h after the end. */
    handoverOpen: now.getTime() >= b.start.getTime() - CONDITION_DEADLINES.handoverPrepareFromHours * HOUR,
    notReturnedOpen: now.getTime() >= b.end.getTime() + CONDITION_DEADLINES.notReturnedAfterHours * HOUR,
    templateIsDraft: shown ? await templateIsDraft(shown.templateVersionId) : false,
    title: b.title,
    start: b.start,
    end: b.end,
    role,
    ownerName: name(b.booking.ownerId),
    renterName: name(b.booking.renterId),
    events,
    contract: live,
    contracts: allContracts,
    acceptances,
    reports,
    dispute: dispute[0] ?? null,
    isActive: ACTIVE_STATUSES.includes(b.booking.status),
  };
}

export type BookingView = NonNullable<Awaited<ReturnType<typeof getBookingForParty>>>;

/** AI-drafted templates stay labelled as not legally reviewed until a lawyer has approved them. */
async function templateIsDraft(templateVersionId: string): Promise<boolean> {
  const [t] = await db
    .select({ isDraft: legalDocumentVersions.isDraft })
    .from(legalDocumentVersions)
    .where(eq(legalDocumentVersions.id, templateVersionId));
  return t?.isDraft ?? true;
}

/**
 * The informational English rendering of a stored agreement, from the same terms snapshot.
 * The Norwegian stored text is the one that applies and the one that is accepted.
 */
export async function englishAgreementText(c: { kind: ContractKind; terms: unknown }): Promise<string | null> {
  const en = await loadTemplate(db, c.kind, "en");
  return en ? renderContract(en.contentMd, c.terms as ContractTerms, "en").text : null;
}

/** One report with its full history, photos and the current decisions. */
export async function getConditionReport(bookingId: string, phase: ReportPhase) {
  const [report] = await db
    .select()
    .from(conditionReports)
    .where(and(eq(conditionReports.bookingId, bookingId), eq(conditionReports.phase, phase)));
  if (!report) return null;
  const entries = await db
    .select()
    .from(conditionEntries)
    .where(eq(conditionEntries.reportId, report.id))
    .orderBy(desc(conditionEntries.seq));
  const photos = entries.length
    ? await db
        .select({ entryId: conditionPhotos.entryId, mediaId: conditionPhotos.mediaId })
        .from(conditionPhotos)
        .where(
          inArray(
            conditionPhotos.entryId,
            entries.map((e) => e.id),
          ),
        )
    : [];
  const confirmations = await db
    .select()
    .from(conditionConfirmations)
    .where(eq(conditionConfirmations.reportId, report.id))
    .orderBy(desc(conditionConfirmations.createdAt));
  const superseded = new Set(entries.map((e) => e.supersedesEntryId).filter(Boolean));
  return {
    report,
    entries: entries.map((e) => ({
      ...e,
      current: !superseded.has(e.id),
      photoIds: photos.filter((p) => p.entryId === e.id).map((p) => p.mediaId),
    })),
    confirmations,
    decisions: await decisions(db, report.id),
  };
}

export type ConditionReportView = NonNullable<Awaited<ReturnType<typeof getConditionReport>>>;

/** The giveaway page (`/overlevering/[claimId]`), for giver and claimant only. */
export async function getClaimForParty(actor: Actor, claimId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) return null;
  const [g] = await db
    .select({ claim: giveawayClaims, title: listings.title, listingStatus: listings.status })
    .from(giveawayClaims)
    .innerJoin(listings, eq(listings.id, giveawayClaims.listingId))
    .where(eq(giveawayClaims.id, claimId));
  if (!g) return null;
  if (!can(actor, "claim.view", { type: "claim", giverId: g.claim.giverId, claimantId: g.claim.claimantId }).allow)
    return null;
  const me = (actor as { id: string }).id;
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, [g.claim.giverId, g.claim.claimantId]));
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "";
  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.giveawayClaimId, claimId), inArray(contracts.status, ["pending_acceptance", "accepted"])));
  const acceptances = contract
    ? await db.select().from(contractAcceptances).where(eq(contractAcceptances.contractId, contract.id))
    : [];
  return {
    templateIsDraft: contract ? await templateIsDraft(contract.templateVersionId) : false,
    claim: g.claim,
    title: g.title,
    role: g.claim.giverId === me ? ("giver" as const) : ("recipient" as const),
    giverName: name(g.claim.giverId),
    claimantName: name(g.claim.claimantId),
    contract: contract ?? null,
    acceptances,
  };
}

/** The giver's list of claims on their own listing. */
export async function listClaimsForGiver(actor: Actor, listingId: string) {
  if (actor.kind !== "user") return [];
  return db
    .select({
      id: giveawayClaims.id,
      status: giveawayClaims.status,
      name: users.name,
      handoverMethod: giveawayClaims.handoverMethod,
      createdAt: giveawayClaims.createdAt,
    })
    .from(giveawayClaims)
    .innerJoin(users, eq(users.id, giveawayClaims.claimantId))
    .where(and(eq(giveawayClaims.listingId, listingId), eq(giveawayClaims.giverId, actor.id)))
    .orderBy(asc(giveawayClaims.createdAt));
}

/** The viewer's own claim on a listing, if any (to show «Du har meldt interesse»). */
export async function myClaimOn(actor: Actor, listingId: string) {
  if (actor.kind !== "user") return null;
  const [g] = await db
    .select({ id: giveawayClaims.id, status: giveawayClaims.status })
    .from(giveawayClaims)
    .where(and(eq(giveawayClaims.listingId, listingId), eq(giveawayClaims.claimantId, actor.id)));
  return g ?? null;
}

/** The viewer's own booking on a listing that is still open or under way (to link to it instead of a new form). */
export async function myOpenBookingOn(actor: Actor, listingId: string) {
  if (actor.kind !== "user") return null;
  const rows = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.listingId, listingId), eq(bookings.renterId, actor.id)))
    .orderBy(desc(bookings.createdAt));
  return rows.find((b) => !TERMINAL_STATUSES.includes(b.status)) ?? null;
}
