import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import {
  bookings,
  conditionEntries,
  conditionPhotos,
  conditionReports,
  disputeEvents,
  disputeProposals,
  disputes,
  listings,
  messages,
  supportAccessGrants,
  users,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { getRequestMeta } from "@/modules/server/request-meta";
import { activeGrant } from "./access";
import { canReopen, DISPUTE_DEADLINES, encodeRecommendation, isOpen, MAX_CASE_EVENTS, STAFF_CLOSURES } from "./rules";
import { caseTitle, closeCase, lockCase, tellParties } from "./service";

/**
 * Staff facilitation (P03-01, DISPUTE_POLICY §2 step 4–6). Staff read a case only with a time-boxed
 * grant, every read is audited, and staff can never change evidence, accept for a party or move money.
 */
type DisputeRow = typeof disputes.$inferSelect;
const DAY = 24 * 60 * 60 * 1000;
const reasonText = z.string().trim().min(10, { error: "reason_too_short" }).max(500, { error: "too_long" });

async function loadForStaff(actor: Actor, disputeId: string): Promise<DisputeRow> {
  if (!/^[0-9a-f-]{36}$/i.test(disputeId)) throw new AppError("not_found");
  const [d] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
  if (!d) throw new AppError("not_found");
  assertCan(actor, "dispute.support", { type: "dispute", openerId: d.openedBy, respondentId: d.respondentId });
  return d;
}

async function requireGrant(actor: UserActor, d: DisputeRow) {
  const g = await activeGrant(db, actor.id, "dispute", d.id);
  if (!g) throw new AppError("forbidden", "grant_required");
  return g;
}

const moderator = alias(users, "moderator");

/**
 * The support queue: escalated cases only, with no case text (that needs a grant). Cases where the
 * staff member is a party are left out. Repeated cases between the same two people are flagged.
 */
export async function listSupportQueue(actor: Actor) {
  assertCan(actor, "dispute.support");
  const rows = await db
    .select({
      id: disputes.id,
      category: disputes.category,
      status: disputes.status,
      openedAt: disputes.openedAt,
      escalatedAt: disputes.escalatedAt,
      responseDueAt: disputes.responseDueAt,
      reportedLate: disputes.reportedLate,
      openedBy: disputes.openedBy,
      respondentId: disputes.respondentId,
      assignedName: moderator.name,
      assignedId: disputes.assignedModeratorId,
      repeated: sql<number>`(SELECT count(*)::int FROM disputes d2 WHERE d2.opened_by = ${disputes.openedBy} AND d2.respondent_id = ${disputes.respondentId})`,
    })
    .from(disputes)
    .leftJoin(moderator, eq(moderator.id, disputes.assignedModeratorId))
    .where(inArray(disputes.status, ["support_review", "awaiting_documentation"]))
    .orderBy(asc(disputes.escalatedAt))
    .limit(200);
  const me = (actor as UserActor).id;
  return rows
    .filter((r) => r.openedBy !== me && r.respondentId !== me)
    .map((r) => ({ ...r, repeated: r.repeated > 1 }));
}

export const takeSchema = z.object({ disputeId: z.uuid(), reason: reasonText });

/** «Ta saken»: a 30-day grant with a reason; renewing creates a new grant (append-only). */
export async function takeCase(actor: Actor, input: z.infer<typeof takeSchema>, now = new Date()): Promise<void> {
  const d = await loadForStaff(actor, input.disputeId);
  if (!isOpen(d.status) || (d.status !== "support_review" && d.status !== "awaiting_documentation"))
    throw new AppError("conflict", "case_not_escalated");
  const meta = await getRequestMeta();
  const me = (actor as UserActor).id;
  await db.transaction(async (tx) => {
    await tx.insert(supportAccessGrants).values({
      staffId: me,
      scope: "dispute",
      targetId: d.id,
      disputeId: d.id,
      reason: input.reason,
      grantedAt: now,
      expiresAt: new Date(now.getTime() + DISPUTE_DEADLINES.grantDays * DAY),
    });
    await tx.update(disputes).set({ assignedModeratorId: me }).where(eq(disputes.id, d.id));
    await recordAudit(tx, {
      actorId: me,
      actorRole: (actor as UserActor).role,
      action: "staff.grant_dispute",
      targetType: "dispute",
      targetId: d.id,
      reason: input.reason,
      meta,
    });
  });
}

/**
 * The whole case for the assigned staff member: statements (also staff-only notes), proposals, the
 * booking's condition reports and the messages the parties referenced — nothing else from the thread.
 */
export async function getCaseForStaff(actor: Actor, disputeId: string) {
  const d = await loadForStaff(actor, disputeId);
  const grant = await requireGrant(actor as UserActor, d);
  const meta = await getRequestMeta();
  await recordAudit(db, {
    actorId: (actor as UserActor).id,
    actorRole: (actor as UserActor).role,
    action: "staff.view_dispute",
    targetType: "dispute",
    targetId: d.id,
    reason: grant.reason,
    meta,
  });
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      title: listings.title,
      ownerId: bookings.ownerId,
      renterId: bookings.renterId,
      start: sql<string>`lower(${bookings.period})`,
      end: sql<string>`upper(${bookings.period})`,
    })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(eq(bookings.id, d.bookingId));
  const [names, events, proposals, reports] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [d.openedBy, d.respondentId])),
    db
      .select()
      .from(disputeEvents)
      .where(eq(disputeEvents.disputeId, d.id))
      .orderBy(asc(disputeEvents.createdAt))
      .limit(MAX_CASE_EVENTS + 100),
    db
      .select()
      .from(disputeProposals)
      .where(eq(disputeProposals.disputeId, d.id))
      .orderBy(asc(disputeProposals.createdAt))
      .limit(MAX_CASE_EVENTS),
    db.select().from(conditionReports).where(eq(conditionReports.bookingId, d.bookingId)),
  ]);
  const entries = reports.length
    ? await db
        .select()
        .from(conditionEntries)
        .where(
          inArray(
            conditionEntries.reportId,
            reports.map((r) => r.id),
          ),
        )
        .orderBy(asc(conditionEntries.seq))
    : [];
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
  const messageIds = events.flatMap((e) => (e.reference?.type === "message" ? [e.reference.id] : []));
  const referenced = messageIds.length
    ? await db
        .select({ id: messages.id, senderId: messages.senderId, body: messages.body, createdAt: messages.createdAt })
        .from(messages)
        .where(inArray(messages.id, messageIds))
    : [];
  const name = (id: string | null) => names.find((n) => n.id === id)?.name ?? null;
  return {
    dispute: d,
    booking: booking!,
    openerName: name(d.openedBy) ?? "",
    respondentName: name(d.respondentId) ?? "",
    events,
    proposals,
    reports: reports.map((r) => ({
      ...r,
      entries: entries
        .filter((e) => e.reportId === r.id)
        .map((e) => ({ ...e, photoIds: photos.filter((p) => p.entryId === e.id).map((p) => p.mediaId) })),
    })),
    referencedMessages: referenced,
    grantExpiresAt: grant.expiresAt,
  };
}

export const noteSchema = z.object({
  disputeId: z.uuid(),
  body: z.string().trim().min(2, { error: "required" }).max(4000, { error: "too_long" }),
  visibility: z.enum(["parties", "staff_only"]).default("parties"),
});

/** A neutral support note. `staff_only` notes are shown to the parties as «intern merknad». */
export async function addSupportNote(actor: Actor, input: z.infer<typeof noteSchema>): Promise<void> {
  const d = await loadForStaff(actor, input.disputeId);
  await requireGrant(actor as UserActor, d);
  if (!isOpen(d.status)) throw new AppError("conflict", "case_closed");
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    await tx.insert(disputeEvents).values({
      disputeId: d.id,
      actorId: me,
      kind: "support_note",
      body: input.body,
      visibility: input.visibility,
    });
    if (input.visibility === "parties") await tellParties(tx, d, "dispute_update", [d.openedBy, d.respondentId], title);
  });
}

export const documentationSchema = z.object({
  disputeId: z.uuid(),
  body: z.string().trim().min(10, { error: "reason_too_short" }).max(4000, { error: "too_long" }),
});

/** Ask either party for more information: `awaiting_documentation` with a 7-day deadline. */
export async function requestDocumentation(actor: Actor, input: z.infer<typeof documentationSchema>, now = new Date()) {
  const d = await loadForStaff(actor, input.disputeId);
  await requireGrant(actor as UserActor, d);
  if (d.status !== "support_review") throw new AppError("conflict", "case_changed");
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(disputes)
      .set({
        status: "awaiting_documentation",
        responseDueAt: new Date(now.getTime() + DISPUTE_DEADLINES.documentationDays * DAY),
      })
      .where(and(eq(disputes.id, d.id), eq(disputes.status, "support_review")))
      .returning({ id: disputes.id });
    if (!updated.length) throw new AppError("conflict", "case_changed");
    await tx.insert(disputeEvents).values([
      { disputeId: d.id, actorId: me, kind: "support_note", body: input.body },
      { disputeId: d.id, actorId: me, kind: "status_change", body: "awaiting_documentation" },
    ]);
    await tellParties(tx, d, "dispute_update", [d.openedBy, d.respondentId], title);
  });
}

export const recommendSchema = z.object({
  disputeId: z.uuid(),
  documented: z.string().trim().min(2, { error: "required" }).max(1300, { error: "too_long" }),
  disagreed: z.string().trim().min(2, { error: "required" }).max(1300, { error: "too_long" }),
  recommendation: z.string().trim().min(2, { error: "required" }).max(1300, { error: "too_long" }),
});

/** The non-binding recommendation, in the three parts the fairness checklist requires. */
export async function recommend(actor: Actor, input: z.infer<typeof recommendSchema>): Promise<void> {
  const d = await loadForStaff(actor, input.disputeId);
  await requireGrant(actor as UserActor, d);
  if (d.status !== "support_review" && d.status !== "awaiting_documentation")
    throw new AppError("conflict", "case_changed");
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  await db.transaction(async (tx) => {
    // The case may have closed since it was read (security review L2).
    await lockCase(tx, d, false);
    await tx.insert(disputeEvents).values({
      disputeId: d.id,
      actorId: me,
      kind: "support_recommendation",
      body: encodeRecommendation(input),
    });
    if (d.status === "awaiting_documentation") {
      await tx.update(disputes).set({ status: "support_review" }).where(eq(disputes.id, d.id));
      await tx
        .insert(disputeEvents)
        .values({ disputeId: d.id, actorId: me, kind: "status_change", body: "support_review" });
    }
    await tellParties(tx, d, "dispute_update", [d.openedBy, d.respondentId], title);
  });
}

export const closeSchema = z.object({
  disputeId: z.uuid(),
  outcome: z.enum(STAFF_CLOSURES),
  note: z.string().trim().min(10, { error: "reason_too_short" }).max(4000, { error: "too_long" }),
});

/** Closing without agreement comes with neutral information about external options (shown on the case page). */
export async function closeByStaff(actor: Actor, input: z.infer<typeof closeSchema>): Promise<void> {
  const d = await loadForStaff(actor, input.disputeId);
  await requireGrant(actor as UserActor, d);
  if (!isOpen(d.status)) throw new AppError("conflict", "case_closed");
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .update(disputeProposals)
      .set({ status: "withdrawn" })
      .where(and(eq(disputeProposals.disputeId, d.id), eq(disputeProposals.status, "pending")));
    await closeCase(tx, d, input.outcome, me, input.note);
    await tellParties(tx, d, "dispute_closed", [d.openedBy, d.respondentId], title);
    await recordAudit(tx, {
      actorId: me,
      actorRole: (actor as UserActor).role,
      action: "staff.dispute_closed",
      targetType: "dispute",
      targetId: d.id,
      reason: input.outcome,
      meta,
    });
  });
}

export const reopenSchema = z.object({ disputeId: z.uuid(), reason: reasonText });

/** Reopen within 30 days when new information appears (staff decision, audited, new grant). */
export async function reopenCase(actor: Actor, input: z.infer<typeof reopenSchema>, now = new Date()) {
  const d = await loadForStaff(actor, input.disputeId);
  if (!canReopen(d, now)) throw new AppError("conflict", "reopen_not_available");
  const me = (actor as UserActor).id;
  const title = await caseTitle(db, d.bookingId);
  const meta = await getRequestMeta();
  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(disputes)
        .set({ status: "support_review", closedAt: null, reopenedAt: now, assignedModeratorId: me })
        .where(and(eq(disputes.id, d.id), eq(disputes.status, d.status)))
        .returning({ id: disputes.id });
      if (!updated.length) throw new AppError("conflict", "case_changed");
      await tx.insert(disputeEvents).values({ disputeId: d.id, actorId: me, kind: "status_change", body: "reopened" });
      await tx.insert(supportAccessGrants).values({
        staffId: me,
        scope: "dispute",
        targetId: d.id,
        disputeId: d.id,
        reason: input.reason,
        grantedAt: now,
        expiresAt: new Date(now.getTime() + DISPUTE_DEADLINES.grantDays * DAY),
      });
      await tellParties(tx, d, "dispute_update", [d.openedBy, d.respondentId], title);
      await recordAudit(tx, {
        actorId: me,
        actorRole: (actor as UserActor).role,
        action: "staff.dispute_reopened",
        targetType: "dispute",
        targetId: d.id,
        reason: input.reason,
        meta,
      });
    });
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23505") throw new AppError("conflict", "case_open");
    throw err;
  }
}

/** Recently closed, once escalated cases a staff member may reopen (metadata only). */
export async function listRecentlyClosed(actor: Actor, now = new Date()) {
  assertCan(actor, "dispute.support");
  const since = new Date(now.getTime() - DISPUTE_DEADLINES.reopenDays * DAY);
  const me = (actor as UserActor).id;
  const rows = await db
    .select({
      id: disputes.id,
      category: disputes.category,
      status: disputes.status,
      closedAt: disputes.closedAt,
      openedBy: disputes.openedBy,
      respondentId: disputes.respondentId,
    })
    .from(disputes)
    .where(and(sql`${disputes.closedAt} >= ${since.toISOString()}::timestamptz`, isNotNull(disputes.escalatedAt)))
    .orderBy(desc(disputes.closedAt))
    .limit(50);
  return rows.filter((r) => r.openedBy !== me && r.respondentId !== me);
}

/** Open cases waiting for staff (dashboard count). */
export async function supportQueueCount(actor: Actor): Promise<number> {
  assertCan(actor, "dispute.support");
  const [r] = await db
    .select({ n: count() })
    .from(disputes)
    .where(inArray(disputes.status, ["support_review", "awaiting_documentation"]));
  return r?.n ?? 0;
}

/** What a staff member may know before taking a case: metadata only, never the text. */
export async function getCaseMetaForStaff(actor: Actor, disputeId: string, now = new Date()) {
  const d = await loadForStaff(actor, disputeId);
  const grant = await activeGrant(db, (actor as UserActor).id, "dispute", d.id, now);
  return {
    id: d.id,
    category: d.category,
    status: d.status,
    openedAt: d.openedAt,
    escalatedAt: d.escalatedAt,
    closedAt: d.closedAt,
    reportedLate: d.reportedLate,
    hasGrant: Boolean(grant),
    canTake: d.status === "support_review" || d.status === "awaiting_documentation",
    canReopen: canReopen(d, now),
  };
}
