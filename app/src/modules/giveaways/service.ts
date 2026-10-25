import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import { contracts, giveawayClaims, HANDOVER_METHODS, listings, messages, userProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import {
  closeLiveContract,
  createGiveawayContract,
  markContractAccepted,
  recordAcceptance,
} from "@/modules/contracts/service";
import { AppError } from "@/modules/errors";
import { getOrCreateConversation, isBlockedBetween, postSystemMessage } from "@/modules/messaging/conversations";
import type { ActivityKind } from "@/modules/notifications/email-templates";
import { notify } from "@/modules/notifications/notify";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta } from "@/modules/server/request-meta";

/** Unanswered claims expire after 14 days (DATA_MODEL §6). */
export const CLAIM_EXPIRY_DAYS = 14;

type ClaimRow = typeof giveawayClaims.$inferSelect;

export async function loadClaimFor(
  actor: Actor,
  claimId: string,
  action: "claim.view" | "claim.participate" | "claim.respond",
) {
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) throw new AppError("not_found");
  const [g] = await db.select().from(giveawayClaims).where(eq(giveawayClaims.id, claimId));
  if (!g) throw new AppError("not_found");
  assertCan(actor, action, { type: "claim", giverId: g.giverId, claimantId: g.claimantId });
  return g;
}

async function title(tx: typeof db | Tx, listingId: string) {
  const [l] = await tx.select({ title: listings.title }).from(listings).where(eq(listings.id, listingId));
  return l?.title ?? "";
}

async function tell(tx: Tx, g: ClaimRow, key: string, kind: ActivityKind, userId: string, label: string) {
  await postSystemMessage(tx, g.conversationId, key);
  await notify(tx, { userId, kind, title: label, path: `/overlevering/${g.id}`, email: "essential" });
}

/** Moves a claim only if its status is still what we read. */
async function moveClaim(
  tx: Tx,
  g: ClaimRow,
  to: ClaimRow["status"],
  set: Partial<typeof giveawayClaims.$inferInsert> = {},
) {
  const updated = await tx
    .update(giveawayClaims)
    .set({ ...set, status: to, updatedAt: new Date() })
    .where(and(eq(giveawayClaims.id, g.id), eq(giveawayClaims.status, g.status)))
    .returning({ id: giveawayClaims.id });
  if (!updated.length) throw new AppError("conflict", "claim_changed");
}

export const claimSchema = z.object({
  listingId: z.uuid(),
  handoverMethod: z
    .enum(HANDOVER_METHODS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  message: z.string().trim().max(2000, { error: "too_long" }).optional().default(""),
});

/** «Jeg vil gjerne ha den» (P02-03). One claim per person per listing. */
export async function createClaim(actor: Actor, input: z.infer<typeof claimSchema>): Promise<{ id: string }> {
  assertCan(actor, "claim.create");
  const [l] = await db.select().from(listings).where(eq(listings.id, input.listingId));
  if (!l || l.status !== "published" || l.deletedAt || l.type !== "give_away") throw new AppError("not_found");
  if (l.isDemo) throw new AppError("forbidden", "demo_listing");
  if (l.ownerId === actor.id) throw new AppError("forbidden", "own_listing");
  const [giver] = await db
    .select({ status: userProfiles.status })
    .from(userProfiles)
    .where(eq(userProfiles.userId, l.ownerId));
  if (!giver || giver.status !== "active") throw new AppError("not_found");
  if (await isBlockedBetween(db, actor.id, l.ownerId)) throw new AppError("forbidden", "blocked");
  if (input.handoverMethod) {
    const allowed = { pickup: l.handoverPickup, owner_delivery: l.handoverOwnerDelivery, meet: l.handoverMeet };
    if (!allowed[input.handoverMethod])
      throw new AppError("validation", "request_invalid", { fieldErrors: { handoverMethod: "method_not_offered" } });
  }
  const [existing] = await db
    .select({ id: giveawayClaims.id })
    .from(giveawayClaims)
    .where(and(eq(giveawayClaims.listingId, l.id), eq(giveawayClaims.claimantId, actor.id)));
  if (existing) throw new AppError("conflict", "already_claimed");
  await enforceRateLimits(db, [
    { bucket: `request:user:${actor.id}`, rule: actor.isNewAccount ? LIMITS.requestsNew : LIMITS.requestsEstablished },
  ]);
  const meta = await getRequestMeta();
  return db.transaction(async (tx) => {
    const conversationId = await getOrCreateConversation(tx, {
      listingId: l.id,
      ownerId: l.ownerId,
      initiatorId: actor.id,
    });
    const [g] = await tx
      .insert(giveawayClaims)
      .values({
        listingId: l.id,
        conversationId,
        giverId: l.ownerId,
        claimantId: actor.id,
        handoverMethod: input.handoverMethod ?? null,
      })
      .returning();
    if (input.message)
      await tx.insert(messages).values({ conversationId, senderId: actor.id, kind: "user", body: input.message });
    await tell(tx, g!, "claim.requested", "claim_received", l.ownerId, l.title);
    await recordAudit(tx, {
      actorId: actor.id,
      action: "claim.create",
      targetType: "giveaway_claim",
      targetId: g!.id,
      meta,
    });
    return { id: g!.id };
  });
}

/** The giver picks one person: claim `selected`, listing `reserved`, transfer confirmation rendered. */
export async function selectClaim(actor: Actor, claimId: string): Promise<void> {
  const g = await loadClaimFor(actor, claimId, "claim.respond");
  if (g.status !== "requested") throw new AppError("conflict", "claim_changed");
  const label = await title(db, g.listingId);
  try {
    await db.transaction(async (tx) => {
      const reserved = await tx
        .update(listings)
        .set({ status: "reserved", updatedAt: new Date() })
        .where(and(eq(listings.id, g.listingId), eq(listings.status, "published")))
        .returning({ id: listings.id });
      if (!reserved.length) throw new AppError("conflict", "listing_not_available");
      await moveClaim(tx, g, "selected", { selectedAt: new Date() });
      await createGiveawayContract(tx, g.id);
      await tell(tx, g, "claim.selected", "claim_selected", g.claimantId, label);
      // The others keep their claims open, but are told «ikke valgt nå».
      const others = await tx
        .select({ claimantId: giveawayClaims.claimantId })
        .from(giveawayClaims)
        .where(
          and(
            eq(giveawayClaims.listingId, g.listingId),
            eq(giveawayClaims.status, "requested"),
            ne(giveawayClaims.id, g.id),
          ),
        );
      for (const o of others) {
        await notify(tx, {
          userId: o.claimantId,
          kind: "claim_not_selected",
          title: label,
          path: `/annonse/${g.listingId}`,
          email: "optional",
        });
      }
    });
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23505")
      throw new AppError("conflict", "already_selected");
    throw err;
  }
}

export async function declineClaim(actor: Actor, claimId: string): Promise<void> {
  const g = await loadClaimFor(actor, claimId, "claim.respond");
  if (g.status !== "requested") throw new AppError("conflict", "claim_changed");
  const label = await title(db, g.listingId);
  await db.transaction(async (tx) => {
    await moveClaim(tx, g, "declined");
    await tell(tx, g, "claim.declined", "claim_cancelled", g.claimantId, label);
  });
}

export async function withdrawClaim(actor: Actor, claimId: string): Promise<void> {
  const g = await loadClaimFor(actor, claimId, "claim.participate");
  if (g.claimantId !== (actor as UserActor).id) throw new AppError("forbidden");
  if (g.status !== "requested" && g.status !== "selected") throw new AppError("conflict", "claim_changed");
  const label = await title(db, g.listingId);
  await db.transaction(async (tx) => {
    await moveClaim(tx, g, g.status === "selected" ? "cancelled" : "withdrawn");
    if (g.status === "selected") await reopenListing(tx, g);
    await tell(tx, g, "claim.withdrawn", "claim_cancelled", g.giverId, label);
  });
}

/** A selected claim can be cancelled by either party; the listing is available again. */
export async function cancelSelectedClaim(actor: Actor, claimId: string): Promise<void> {
  const g = await loadClaimFor(actor, claimId, "claim.participate");
  if (g.status !== "selected") throw new AppError("conflict", "claim_changed");
  const other = g.giverId === (actor as UserActor).id ? g.claimantId : g.giverId;
  const label = await title(db, g.listingId);
  await db.transaction(async (tx) => {
    await moveClaim(tx, g, "cancelled");
    await reopenListing(tx, g);
    await tell(tx, g, "claim.cancelled", "claim_cancelled", other, label);
  });
}

async function reopenListing(tx: Tx, g: ClaimRow) {
  await closeLiveContract(tx, { claimId: g.id }, "void");
  await tx
    .update(listings)
    .set({ status: "published", updatedAt: new Date() })
    .where(and(eq(listings.id, g.listingId), eq(listings.status, "reserved")));
}

/** Each party confirms the exact transfer text after the handover; both → «Gitt bort». */
export async function confirmTransfer(
  actor: Actor,
  claimId: string,
  shownSha256: string,
): Promise<"waiting" | "transferred"> {
  const g = await loadClaimFor(actor, claimId, "claim.participate");
  if (g.status !== "selected") throw new AppError("conflict", "claim_changed");
  const me = (actor as UserActor).id;
  const role = g.giverId === me ? "giver" : "recipient";
  const label = await title(db, g.listingId);
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.giveawayClaimId, g.id), eq(contracts.status, "pending_acceptance")));
    if (!c) throw new AppError("conflict", "agreement_not_open");
    const roles = await recordAcceptance(tx, c.id, me, role, shownSha256);
    if (!(roles.includes("giver") && roles.includes("recipient"))) {
      await notify(tx, {
        userId: role === "giver" ? g.claimantId : g.giverId,
        kind: "transfer_to_confirm",
        title: label,
        path: `/overlevering/${g.id}`,
        email: "essential",
      });
      return "waiting";
    }
    await markContractAccepted(tx, c.id);
    await moveClaim(tx, g, "transferred", { transferredAt: new Date() });
    await tx.update(listings).set({ status: "given_away", updatedAt: new Date() }).where(eq(listings.id, g.listingId));
    await tx
      .update(giveawayClaims)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(giveawayClaims.listingId, g.listingId), inArray(giveawayClaims.status, ["requested"])));
    await postSystemMessage(tx, g.conversationId, "claim.transferred");
    for (const userId of [g.giverId, g.claimantId]) {
      await notify(tx, {
        userId,
        kind: "transfer_confirmed",
        title: label,
        path: `/overlevering/${g.id}`,
        email: "essential",
      });
    }
    return "transferred";
  });
}
