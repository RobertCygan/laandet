import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx, type Tx } from "@/db/client";
import {
  bookings,
  DISPUTE_CATEGORIES,
  disputeEvents,
  disputeProposals,
  disputes,
  listings,
  mediaObjects,
  messages,
  PROPOSAL_TYPES,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { postSystemMessage } from "@/modules/messaging/conversations";
import type { ActivityKind } from "@/modules/notifications/email-templates";
import { notify } from "@/modules/notifications/notify";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { loadBookingFor, moveBooking } from "@/modules/rentals/service";
import { inviteReviews } from "@/modules/reviews/service";
import { getRequestMeta } from "@/modules/server/request-meta";
import {
  canEscalate,
  decodeRecommendation,
  DISPUTE_DEADLINES,
  isOpen,
  OPEN_DISPUTE_STATUSES,
  REPORTABLE_BOOKING_STATUSES,
  reportedLate,
  type ClosedDisputeStatus,
  type DisputeStatus,
} from "./rules";

/**
 * The parties' side of a dispute (P03-01, DISPUTE_POLICY §2 steps 1–3 and 6). Laandet facilitates:
 * it records what each party says and proposes, and never decides who is right or moves money.
 */
type DisputeRow = typeof disputes.$inferSelect;
const DAY = 24 * 60 * 60 * 1000;
const MAX_PHOTOS = 6;

export async function loadDisputeFor(
  actor: Actor,
  disputeId: string,
  action: "dispute.view" | "dispute.participate",
): Promise<DisputeRow> {
  if (!/^[0-9a-f-]{36}$/i.test(disputeId)) throw new AppError("not_found");
  const [d] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
  if (!d) throw new AppError("not_found");
  assertCan(actor, action, { type: "dispute", openerId: d.openedBy, respondentId: d.respondentId });
  return d;
}

export async function caseTitle(conn: DbOrTx, bookingId: string): Promise<string> {
  const [r] = await conn
    .select({ title: listings.title })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(eq(bookings.id, bookingId));
  return r?.title ?? "";
}

/** In-app notice + essential email with a link; never the text of the case. */
export async function tellParties(tx: Tx, d: DisputeRow, kind: ActivityKind, to: string[], title: string) {
  for (const userId of to) {
    await notify(tx, { userId, kind, title, path: `/saker/${d.id}`, email: "essential" });
  }
}

const otherParty = (d: DisputeRow, me: string) => (d.openedBy === me ? d.respondentId : d.openedBy);

/** Moves a case only if its status is still what we read. */
async function setStatus(tx: Tx, d: DisputeRow, to: DisputeStatus, actorId: string | null, set = {}) {
  const updated = await tx
    .update(disputes)
    .set({ ...set, status: to })
    .where(and(eq(disputes.id, d.id), eq(disputes.status, d.status)))
    .returning({ id: disputes.id });
  if (!updated.length) throw new AppError("conflict", "case_changed");
  await tx.insert(disputeEvents).values({ disputeId: d.id, actorId, kind: "status_change", body: to });
}

/**
 * Closes a case (agreement, withdrawal or a staff closure). A `disputed` booking returns to
 * `completed`; the outcome stays on the case, never on the booking (DATA_MODEL §5).
 */
export async function closeCase(
  tx: Tx,
  d: DisputeRow,
  to: ClosedDisputeStatus,
  actorId: string | null,
  note: string | null,
  now = new Date(),
) {
  await setStatus(tx, d, to, actorId, { closedAt: now, closureNote: note });
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, d.bookingId)).for("update");
  if (b?.status === "disputed") {
    await moveBooking(tx, b, "dispute_closed", "system", null, {}, { disputeId: d.id });
    // The review window restarts when the case closes (P03-02).
    await inviteReviews(tx, b, await caseTitle(tx, b.id));
  }
}

/** Own, not yet attached photos uploaded for a case (scope `dispute`). */
async function assertOwnPhotos(tx: Tx, me: string, ids: string[]) {
  if (!ids.length) return;
  if (ids.length > MAX_PHOTOS) throw new AppError("validation", "too_many_photos");
  const own = await tx
    .select({ id: mediaObjects.id })
    .from(mediaObjects)
    .leftJoin(disputeEvents, eq(disputeEvents.mediaId, mediaObjects.id))
    .where(
      and(
        inArray(mediaObjects.id, ids),
        eq(mediaObjects.uploadedBy, me),
        eq(mediaObjects.scope, "dispute"),
        isNull(mediaObjects.deletedAt),
        isNull(disputeEvents.id),
      ),
    );
  if (own.length !== new Set(ids).size) throw new AppError("not_found", "media");
}

async function addPhotos(tx: Tx, disputeId: string, me: string, ids: string[]) {
  for (const mediaId of ids)
    await tx.insert(disputeEvents).values({ disputeId, actorId: me, kind: "evidence_photo", mediaId });
}

const photoIds = z.array(z.uuid()).max(MAX_PHOTOS, { error: "too_many_photos" }).default([]);

// ---------------------------------------------------------------- step 1: report

export const openSchema = z.object({
  bookingId: z.uuid(),
  category: z.enum(DISPUTE_CATEGORIES, { error: "required" }),
  summary: z.string().trim().min(10, { error: "summary_too_short" }).max(4000, { error: "too_long" }),
  photoIds,
});

/** «Meld fra om et problem». A late case is accepted and marked; one open case per booking. */
export async function openDispute(
  actor: Actor,
  input: z.infer<typeof openSchema>,
  now = new Date(),
): Promise<{ id: string }> {
  const b = await loadBookingFor(actor, input.bookingId, "booking.participate");
  assertCan(actor, "dispute.open", { type: "booking", ownerId: b.ownerId, renterId: b.renterId });
  if (!REPORTABLE_BOOKING_STATUSES.includes(b.status)) throw new AppError("conflict", "dispute_not_available");
  const me = actor.id;
  const role = b.ownerId === me ? "owner" : "renter";
  const [open] = await db
    .select({ id: disputes.id })
    .from(disputes)
    .where(and(eq(disputes.bookingId, b.id), inArray(disputes.status, [...OPEN_DISPUTE_STATUSES])));
  if (open) throw new AppError("conflict", "case_open");
  await enforceRateLimits(db, [{ bucket: `dispute:user:${me}`, rule: LIMITS.reports }]);
  const title = await caseTitle(db, b.id);
  const meta = await getRequestMeta();
  try {
    return await db.transaction(async (tx) => {
      await assertOwnPhotos(tx, me, input.photoIds);
      const [d] = await tx
        .insert(disputes)
        .values({
          bookingId: b.id,
          openedBy: me,
          respondentId: role === "owner" ? b.renterId : b.ownerId,
          category: input.category,
          summary: input.summary,
          responseDueAt: new Date(now.getTime() + DISPUTE_DEADLINES.responseDays * DAY),
          reportedLate: reportedLate(input.category, b.returnedAt ?? b.completedAt, now),
        })
        .returning();
      await addPhotos(tx, d!.id, me, input.photoIds);
      if (b.status === "completed") await moveBooking(tx, b, "open_dispute", role, me, {}, { disputeId: d!.id });
      await postSystemMessage(tx, b.conversationId, "booking.disputed");
      await tellParties(tx, d!, "dispute_opened", [d!.respondentId], title);
      await recordAudit(tx, { actorId: me, action: "dispute.open", targetType: "dispute", targetId: d!.id, meta });
      return { id: d!.id };
    });
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23505") throw new AppError("conflict", "case_open");
    throw err;
  }
}

// ---------------------------------------------------------------- step 2: documentation

export const statementSchema = z
  .object({
    disputeId: z.uuid(),
    body: z.string().trim().max(4000, { error: "too_long" }).default(""),
    photoIds,
  })
  .refine((v) => v.body.length >= 2 || v.photoIds.length > 0, { error: "required", path: ["body"] });

/**
 * A statement and/or photos. The respondent's first answer moves the case to `in_negotiation`;
 * an answer to a staff request moves it back to `support_review`.
 */
export async function addStatement(actor: Actor, input: z.infer<typeof statementSchema>): Promise<void> {
  const d = await loadDisputeFor(actor, input.disputeId, "dispute.participate");
  if (!isOpen(d.status)) throw new AppError("conflict", "case_closed");
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    await assertOwnPhotos(tx, me, input.photoIds);
    if (input.body)
      await tx.insert(disputeEvents).values({ disputeId: d.id, actorId: me, kind: "statement", body: input.body });
    await addPhotos(tx, d.id, me, input.photoIds);
    await afterPartyInput(tx, d, me);
    await tellParties(tx, d, "dispute_update", [otherParty(d, me)], title);
  });
}

async function afterPartyInput(tx: Tx, d: DisputeRow, me: string) {
  if (d.status === "awaiting_response" && me === d.respondentId) await setStatus(tx, d, "in_negotiation", me);
  if (d.status === "awaiting_documentation") await setStatus(tx, d, "support_review", me);
}

export const referenceSchema = z.object({ disputeId: z.uuid(), messageId: z.uuid() });

/**
 * Attaches a message from the booking conversation to the case. The reference makes that message —
 * and only that one — visible to support staff if the case is escalated.
 */
export async function addMessageReference(actor: Actor, input: z.infer<typeof referenceSchema>): Promise<void> {
  const d = await loadDisputeFor(actor, input.disputeId, "dispute.participate");
  if (!isOpen(d.status)) throw new AppError("conflict", "case_closed");
  const me = (actor as UserActor).id;
  const [m] = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(bookings, eq(bookings.conversationId, messages.conversationId))
    .where(and(eq(messages.id, input.messageId), eq(bookings.id, d.bookingId), eq(messages.kind, "user")));
  if (!m) throw new AppError("not_found");
  const [dup] = await db
    .select({ id: disputeEvents.id })
    .from(disputeEvents)
    .where(
      and(
        eq(disputeEvents.disputeId, d.id),
        eq(disputeEvents.kind, "reference"),
        sql`${disputeEvents.reference} = ${JSON.stringify({ type: "message", id: m.id })}::jsonb`,
      ),
    );
  if (dup) return;
  await db.insert(disputeEvents).values({
    disputeId: d.id,
    actorId: me,
    kind: "reference",
    reference: { type: "message", id: m.id },
  });
}

// ---------------------------------------------------------------- step 3: proposals

export const proposalSchema = z
  .object({
    disputeId: z.uuid(),
    type: z.enum(PROPOSAL_TYPES, { error: "required" }),
    amountOre: z.number().int().min(0).max(100_000_000).optional(),
    newReturnAt: z.iso.datetime({ offset: true, error: "date_invalid" }).optional(),
    text: z.string().trim().min(1, { error: "required" }).max(2000, { error: "too_long" }),
  })
  .refine((v) => !["partial_compensation", "full_compensation"].includes(v.type) || v.amountOre !== undefined, {
    error: "amount_required",
    path: ["amount"],
  })
  .refine((v) => v.type !== "extra_return_time" || v.newReturnAt !== undefined, {
    error: "date_invalid",
    path: ["newReturnAt"],
  });

/** A proposal replaces any earlier pending one (a counter-proposal supersedes it). */
export async function makeProposal(actor: Actor, input: z.infer<typeof proposalSchema>, now = new Date()) {
  const d = await loadDisputeFor(actor, input.disputeId, "dispute.participate");
  if (!isOpen(d.status)) throw new AppError("conflict", "case_closed");
  if (input.newReturnAt && new Date(input.newReturnAt) <= now)
    throw new AppError("validation", "proposal_invalid", { fieldErrors: { newReturnAt: "period_in_past" } });
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    await tx
      .update(disputeProposals)
      .set({ status: "superseded" })
      .where(and(eq(disputeProposals.disputeId, d.id), eq(disputeProposals.status, "pending")));
    const [p] = await tx
      .insert(disputeProposals)
      .values({
        disputeId: d.id,
        proposerId: me,
        type: input.type,
        amountOre: ["partial_compensation", "full_compensation"].includes(input.type) ? input.amountOre : null,
        newReturnAt: input.type === "extra_return_time" && input.newReturnAt ? new Date(input.newReturnAt) : null,
        text: input.text,
      })
      .returning({ id: disputeProposals.id });
    await tx
      .insert(disputeEvents)
      .values({ disputeId: d.id, actorId: me, kind: "proposal", reference: { type: "proposal", id: p!.id } });
    await afterPartyInput(tx, d, me);
    await tellParties(tx, d, "dispute_update", [otherParty(d, me)], title);
  });
}

export const respondSchema = z.object({ proposalId: z.uuid(), decision: z.enum(["accept", "reject"]) });

/** «Godta» / «Avslå». Nobody can accept their own proposal (service, CHECK and trigger). */
export async function respondToProposal(actor: Actor, input: z.infer<typeof respondSchema>, now = new Date()) {
  if (actor.kind !== "user") throw new AppError("auth_required");
  const [p] = await db.select().from(disputeProposals).where(eq(disputeProposals.id, input.proposalId));
  if (!p) throw new AppError("not_found");
  const d = await loadDisputeFor(actor, p.disputeId, "dispute.participate");
  if (p.proposerId === actor.id) throw new AppError("forbidden", "own_proposal");
  if (p.status !== "pending" || !isOpen(d.status)) throw new AppError("conflict", "proposal_not_open");
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(disputeProposals)
      .set({ status: input.decision === "accept" ? "accepted" : "rejected", respondedBy: actor.id, respondedAt: now })
      .where(and(eq(disputeProposals.id, p.id), eq(disputeProposals.status, "pending")))
      .returning({ id: disputeProposals.id });
    if (!updated.length) throw new AppError("conflict", "proposal_not_open");
    await tx.insert(disputeEvents).values({
      disputeId: d.id,
      actorId: actor.id,
      kind: "proposal_response",
      body: input.decision,
      reference: { type: "proposal", id: p.id },
    });
    if (input.decision === "accept") {
      await closeCase(tx, d, "resolved_by_agreement", actor.id, p.text, now);
      await tellParties(tx, d, "dispute_closed", [d.openedBy, d.respondentId], title);
    } else {
      await afterPartyInput(tx, d, actor.id);
      await tellParties(tx, d, "dispute_update", [p.proposerId], title);
    }
  });
}

export const recommendationAnswerSchema = z.object({
  disputeId: z.uuid(),
  eventId: z.uuid(),
  decision: z.enum(["accept", "reject"]),
});

/** Each party accepts or rejects the latest staff recommendation; both accept → resolved. */
export async function answerRecommendation(actor: Actor, input: z.infer<typeof recommendationAnswerSchema>) {
  const d = await loadDisputeFor(actor, input.disputeId, "dispute.participate");
  if (!isOpen(d.status)) throw new AppError("conflict", "case_closed");
  const me = (actor as UserActor).id;
  const [latest] = await db
    .select()
    .from(disputeEvents)
    .where(and(eq(disputeEvents.disputeId, d.id), eq(disputeEvents.kind, "support_recommendation")))
    .orderBy(desc(disputeEvents.createdAt))
    .limit(1);
  if (!latest || latest.id !== input.eventId) throw new AppError("conflict", "recommendation_changed");
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    await tx.insert(disputeEvents).values({
      disputeId: d.id,
      actorId: me,
      kind: "proposal_response",
      body: input.decision,
      reference: { type: "recommendation", id: latest.id },
    });
    const answers = await tx
      .select({ actorId: disputeEvents.actorId, body: disputeEvents.body })
      .from(disputeEvents)
      .where(
        and(
          eq(disputeEvents.disputeId, d.id),
          eq(disputeEvents.kind, "proposal_response"),
          sql`${disputeEvents.reference} = ${JSON.stringify({ type: "recommendation", id: latest.id })}::jsonb`,
        ),
      )
      .orderBy(desc(disputeEvents.createdAt));
    const last = (userId: string) => answers.find((a) => a.actorId === userId)?.body;
    if (last(d.openedBy) === "accept" && last(d.respondentId) === "accept") {
      const rec = decodeRecommendation(latest.body);
      await closeCase(tx, d, "resolved_by_agreement", me, rec?.recommendation ?? null);
      await tellParties(tx, d, "dispute_closed", [d.openedBy, d.respondentId], title);
    } else {
      await tellParties(tx, d, "dispute_update", [otherParty(d, me)], title);
    }
  });
}

// ---------------------------------------------------------------- step 4 (party side) and withdrawal

/** «Be Laandet om hjelp». Both parties are told that support will read the case. */
export async function escalate(actor: Actor, disputeId: string, now = new Date()): Promise<void> {
  const d = await loadDisputeFor(actor, disputeId, "dispute.participate");
  if (!canEscalate(d, now)) throw new AppError("conflict", "escalation_not_available");
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await setStatus(tx, d, "support_review", me, { escalatedAt: now, escalatedBy: me });
    await tx.insert(disputeEvents).values({ disputeId: d.id, actorId: me, kind: "support_request" });
    await tellParties(tx, d, "dispute_escalated", [d.openedBy, d.respondentId], title);
    await recordAudit(tx, { actorId: me, action: "dispute.escalate", targetType: "dispute", targetId: d.id, meta });
  });
}

/** The person who opened the case can withdraw it while it is open. */
export async function withdrawDispute(actor: Actor, disputeId: string): Promise<void> {
  const d = await loadDisputeFor(actor, disputeId, "dispute.participate");
  if (d.openedBy !== (actor as UserActor).id) throw new AppError("forbidden");
  if (!isOpen(d.status)) throw new AppError("conflict", "case_closed");
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    await tx
      .update(disputeProposals)
      .set({ status: "withdrawn" })
      .where(and(eq(disputeProposals.disputeId, d.id), eq(disputeProposals.status, "pending")));
    await closeCase(tx, d, "withdrawn", d.openedBy, null);
    await tellParties(tx, d, "dispute_closed", [d.respondentId], title);
  });
}
