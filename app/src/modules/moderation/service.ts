import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import {
  appeals,
  conversations,
  listings,
  messages,
  moderationActions,
  notifications,
  REPORT_REASONS,
  REPORT_TARGETS,
  reports,
  reviews,
  userProfiles,
  users,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan, can } from "@/modules/authz/policy";
import { env } from "@/modules/config/env";
import { AppError } from "@/modules/errors";
import { queueEmail } from "@/modules/notifications/outbox";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta } from "@/modules/server/request-meta";

export const reportSchema = z.object({
  targetType: z.enum(["listing", "user", "message", "review"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS, { error: "required" }),
  details: z.string().trim().max(2000, { error: "too_long" }).optional().default(""),
  goodFaith: z.literal("on", { error: "must_confirm" }),
});

export async function createReport(actor: Actor, input: z.infer<typeof reportSchema>): Promise<void> {
  assertCan(actor, "report.create");
  await enforceRateLimits(db, [{ bucket: `report:user:${actor.id}`, rule: LIMITS.reports }]);
  if (input.targetType === "listing") {
    const [l] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, input.targetId), ne(listings.status, "deleted")));
    if (!l) throw new AppError("not_found");
  } else if (input.targetType === "message") {
    // Only a participant can report a message, and only one written by the other party (P02-01).
    const [m] = await db
      .select({
        senderId: messages.senderId,
        initiatorId: conversations.initiatorId,
        ownerId: conversations.listingOwnerId,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(eq(messages.id, input.targetId), eq(messages.kind, "user")));
    if (!m || (m.initiatorId !== actor.id && m.ownerId !== actor.id) || m.senderId === actor.id) {
      throw new AppError("not_found");
    }
  } else if (input.targetType === "review") {
    // Only published reviews can be seen, so only those can be reported; never one's own (P03-02).
    const [r] = await db
      .select({ authorId: reviews.authorId })
      .from(reviews)
      .where(and(eq(reviews.id, input.targetId), eq(reviews.status, "published")));
    if (!r || r.authorId === actor.id) throw new AppError("not_found");
  } else {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.targetId));
    if (!u || u.id === actor.id) throw new AppError("not_found");
  }
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(reports)
      .values({
        reporterId: actor.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details || null,
        // Staff may read only messages attached to a report (AUTH_MODEL §4).
        attachedMessageIds: input.targetType === "message" ? [input.targetId] : [],
      })
      .returning({ id: reports.id });
    await recordAudit(tx, { actorId: actor.id, action: "report.create", targetType: "report", targetId: r!.id, meta });
  });
}

const reportedUser = alias(users, "reported_user");

/**
 * The moderation queue (P03-03): every target type. A reported message is the one piece of a
 * conversation staff may read (AUTH_MODEL §4, N15), so listing it is audited. Repeated reports by the
 * same person about the same target in 30 days are flagged.
 */
export async function listOpenReports(actor: Actor, opts: { automaticOnly?: boolean; type?: string } = {}) {
  assertCan(actor, "report.handle");
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reporterId: reports.reporterId,
      reason: reports.reason,
      details: reports.details,
      isAutomatic: reports.isAutomatic,
      createdAt: reports.createdAt,
      listingTitle: listings.title,
      listingStatus: listings.status,
      listingOwnerId: listings.ownerId,
      messageBody: messages.body,
      messageSenderId: messages.senderId,
      reviewComment: reviews.comment,
      reviewStatus: reviews.status,
      reviewAuthorId: reviews.authorId,
      reviewSubjectId: reviews.subjectId,
      userName: reportedUser.name,
      userStatus: userProfiles.status,
      repeated: sql<number>`(SELECT count(*)::int FROM reports r2 WHERE r2.reporter_id = ${reports.reporterId}
        AND r2.target_id = ${reports.targetId} AND r2.created_at > now() - interval '30 days')`,
    })
    .from(reports)
    .leftJoin(listings, and(eq(reports.targetType, "listing"), eq(listings.id, reports.targetId)))
    .leftJoin(messages, and(eq(reports.targetType, "message"), eq(messages.id, reports.targetId)))
    .leftJoin(reviews, and(eq(reports.targetType, "review"), eq(reviews.id, reports.targetId)))
    .leftJoin(reportedUser, and(eq(reports.targetType, "user"), eq(reportedUser.id, reports.targetId)))
    .leftJoin(userProfiles, and(eq(reports.targetType, "user"), eq(userProfiles.userId, reports.targetId)))
    .where(
      and(
        inArray(reports.status, ["open", "in_review"]),
        ...(opts.automaticOnly ? [eq(reports.isAutomatic, true)] : []),
        ...(opts.type && (REPORT_TARGETS as readonly string[]).includes(opts.type)
          ? [eq(reports.targetType, opts.type as (typeof REPORT_TARGETS)[number])]
          : []),
      ),
    )
    .orderBy(desc(reports.createdAt))
    .limit(200);
  const shown = rows.filter((r) => r.targetType === "message" && r.messageBody !== null);
  if (shown.length) {
    const meta = await getRequestMeta();
    for (const r of shown) {
      await recordAudit(db, {
        actorId: actor.id,
        actorRole: (actor as UserActor).role,
        action: "staff.view_report_messages",
        targetType: "report",
        targetId: r.id,
        meta,
      });
    }
  }
  return rows.map((r) => ({ ...r, repeated: r.repeated > 1 }));
}

export const hideSchema = z.object({
  listingId: z.uuid(),
  reportId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  reasonCode: z.enum([
    "prohibited_item",
    "misleading",
    "unsafe",
    "fraud_or_scam",
    "illegal_content",
    "privacy",
    "other",
  ]),
  statement: z.string().trim().min(10, { error: "statement_too_short" }).max(4000, { error: "too_long" }),
});

/** Hide a listing with a statement of reasons (notice-and-action, DSA art. 17 as good practice). */
export async function hideListing(actor: Actor, input: z.infer<typeof hideSchema>): Promise<void> {
  const [l] = await db.select().from(listings).where(eq(listings.id, input.listingId));
  if (!l) throw new AppError("not_found");
  assertCan(actor, "listing.moderate", { type: "listing", ownerId: l.ownerId, status: l.status });
  if (l.status === "removed" || l.status === "deleted") throw new AppError("conflict");
  if (input.reportId) {
    const [r] = await db.select().from(reports).where(eq(reports.id, input.reportId));
    if (!r || r.targetType !== "listing" || r.targetId !== l.id) throw new AppError("not_found");
    if (r.reporterId === actor.id) throw new AppError("forbidden");
  }
  const [owner] = await db
    .select({ email: users.email, name: users.name, locale: userProfiles.locale })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, l.ownerId));
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(listings).set({ status: "removed", updatedAt: new Date() }).where(eq(listings.id, l.id));
    const [action] = await tx
      .insert(moderationActions)
      .values({
        actorId: actor.id,
        targetType: "listing",
        targetId: l.id,
        action: "listing_hidden",
        reasonCode: input.reasonCode,
        statementOfReasons: input.statement,
        reportId: input.reportId ?? null,
      })
      .returning({ id: moderationActions.id });
    if (input.reportId) {
      await tx
        .update(reports)
        .set({ status: "actioned", handledBy: actor.id, handledAt: new Date(), decisionNote: "listing_hidden" })
        .where(eq(reports.id, input.reportId));
    }
    // Close other open reports about the same listing too.
    await tx
      .update(reports)
      .set({ status: "actioned", handledBy: actor.id, handledAt: new Date(), decisionNote: "listing_hidden" })
      .where(
        and(
          eq(reports.targetType, "listing"),
          eq(reports.targetId, l.id),
          inArray(reports.status, ["open", "in_review"]),
        ),
      );
    await tx.insert(notifications).values({
      userId: l.ownerId,
      type: "listing_hidden",
      payload: { listingId: l.id, actionId: action!.id },
    });
    if (owner && !l.isDemo) {
      const prefix = owner.locale === "en" ? "/en" : "";
      await queueEmail(tx, {
        toEmail: owner.email,
        toUserId: l.ownerId,
        template: "listing_hidden",
        locale: owner.locale,
        payload: {
          name: owner.name,
          title: l.title,
          statement: input.statement,
          url: `${env().APP_URL}${prefix}/moderering/${action!.id}`,
        },
      });
    }
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: (actor as UserActor).role,
      action: "moderation.listing_hidden",
      targetType: "listing",
      targetId: l.id,
      reason: input.reasonCode,
      metadata: { moderationActionId: action!.id, reportId: input.reportId ?? null },
      meta,
    });
  });
}

/** Staff never handle reports they made or that concern their own listing or profile (AUTH_MODEL §4). */
async function assertNotOwnCase(actor: UserActor, report: typeof reports.$inferSelect): Promise<void> {
  if (report.reporterId === actor.id) throw new AppError("forbidden");
  if (report.targetType === "user" && report.targetId === actor.id) throw new AppError("forbidden");
  if (report.targetType === "message") {
    const [m] = await db.select({ senderId: messages.senderId }).from(messages).where(eq(messages.id, report.targetId));
    if (m?.senderId === actor.id) throw new AppError("forbidden");
  }
  if (report.targetType === "listing") {
    const [l] = await db.select({ ownerId: listings.ownerId }).from(listings).where(eq(listings.id, report.targetId));
    if (l?.ownerId === actor.id) throw new AppError("forbidden");
  }
  if (report.targetType === "review") {
    const [r] = await db
      .select({ authorId: reviews.authorId, subjectId: reviews.subjectId })
      .from(reviews)
      .where(eq(reviews.id, report.targetId));
    if (r && (r.authorId === actor.id || r.subjectId === actor.id)) throw new AppError("forbidden");
  }
}

export async function dismissReport(actor: Actor, reportId: string, note: string): Promise<void> {
  assertCan(actor, "report.handle");
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!report) throw new AppError("not_found");
  await assertNotOwnCase(actor, report);
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(reports)
      .set({
        status: "dismissed",
        handledBy: actor.id,
        handledAt: new Date(),
        decisionNote: note.slice(0, 2000) || null,
      })
      .where(and(eq(reports.id, reportId), inArray(reports.status, ["open", "in_review"])))
      .returning({ id: reports.id });
    if (!updated.length) throw new AppError("not_found");
    await recordAudit(tx, {
      actorId: actor.id,
      action: "moderation.report_dismissed",
      targetType: "report",
      targetId: reportId,
      meta,
    });
  });
}

/** Who a decision is about: the listing owner, the user, or the review's author. */
async function affectedUser(
  a: typeof moderationActions.$inferSelect,
): Promise<{ userId: string; label: string } | null> {
  if (a.targetType === "listing") {
    const [l] = await db
      .select({ ownerId: listings.ownerId, title: listings.title })
      .from(listings)
      .where(eq(listings.id, a.targetId));
    return l ? { userId: l.ownerId, label: l.title } : null;
  }
  if (a.targetType === "user") return { userId: a.targetId, label: "" };
  if (a.targetType === "review") {
    const [r] = await db
      .select({ authorId: reviews.authorId, comment: reviews.comment })
      .from(reviews)
      .where(eq(reviews.id, a.targetId));
    return r ? { userId: r.authorId, label: r.comment ?? "" } : null;
  }
  return null;
}

/** The affected user's view of a moderation decision (and any appeal). */
export async function getModerationForUser(actor: Actor, actionId: string) {
  if (actor.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(actionId)) return null;
  const [action] = await db.select().from(moderationActions).where(eq(moderationActions.id, actionId));
  if (!action) return null;
  const affected = await affectedUser(action);
  if (!affected || affected.userId !== actor.id) return null;
  const [appeal] = await db
    .select()
    .from(appeals)
    .where(and(eq(appeals.moderationActionId, actionId), eq(appeals.appellantId, actor.id)));
  // Reinstatements and restorations are good news; there is nothing to appeal.
  const appealable = !["listing_restored", "user_reinstated", "review_restored"].includes(action.action);
  return {
    action,
    ownerId: affected.userId,
    listingTitle: affected.label,
    targetLabel: affected.label,
    appealable,
    appeal: appeal ?? null,
  };
}

export const appealSchema = z.object({
  actionId: z.uuid(),
  text: z.string().trim().min(10, { error: "appeal_too_short" }).max(4000, { error: "too_long" }),
});

export async function createAppeal(actor: Actor, input: z.infer<typeof appealSchema>): Promise<void> {
  const view = await getModerationForUser(actor, input.actionId);
  if (!view) throw new AppError("not_found");
  assertCan(actor, "appeal.create", { type: "moderationAction", affectedUserId: view.ownerId });
  if (view.appeal) throw new AppError("conflict", "appeal_exists");
  if (!view.appealable) throw new AppError("conflict");
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(appeals)
      .values({ moderationActionId: input.actionId, appellantId: actor.id, text: input.text })
      .returning({ id: appeals.id });
    await recordAudit(tx, { actorId: actor.id, action: "appeal.create", targetType: "appeal", targetId: a!.id, meta });
  });
}

export async function listOpenAppeals(actor: Actor) {
  assertCan(actor, "report.handle");
  const rows = await db
    .select({
      id: appeals.id,
      text: appeals.text,
      createdAt: appeals.createdAt,
      appellantId: appeals.appellantId,
      actionId: moderationActions.id,
      action: moderationActions.action,
      targetType: moderationActions.targetType,
      targetId: moderationActions.targetId,
      originalActorId: moderationActions.actorId,
      statement: moderationActions.statementOfReasons,
      listingTitle: listings.title,
      appellantName: users.name,
    })
    .from(appeals)
    .innerJoin(moderationActions, eq(moderationActions.id, appeals.moderationActionId))
    .innerJoin(users, eq(users.id, appeals.appellantId))
    .leftJoin(listings, and(eq(moderationActions.targetType, "listing"), eq(listings.id, moderationActions.targetId)))
    .where(eq(appeals.status, "open"))
    .orderBy(asc(appeals.createdAt));
  return rows.map((r) => ({ ...r, listingId: r.targetType === "listing" ? r.targetId : null }));
}

async function otherStaffAvailable(excludeId: string): Promise<boolean> {
  const staff = await db
    .select({ id: userProfiles.userId })
    .from(userProfiles)
    .where(
      and(
        inArray(userProfiles.role, ["moderator", "admin"]),
        eq(userProfiles.status, "active"),
        ne(userProfiles.userId, excludeId),
      ),
    );
  return staff.length > 0;
}

export const decideAppealSchema = z.object({
  appealId: z.uuid(),
  outcome: z.enum(["upheld", "reversed"]),
  decision: z.string().trim().min(10, { error: "statement_too_short" }).max(4000, { error: "too_long" }),
});

/** Appeals are decided by someone other than the original decider when possible (AUTH_MODEL §4). */
export async function decideAppeal(actor: Actor, input: z.infer<typeof decideAppealSchema>): Promise<void> {
  const [row] = await db
    .select({ appeal: appeals, action: moderationActions })
    .from(appeals)
    .innerJoin(moderationActions, eq(moderationActions.id, appeals.moderationActionId))
    .where(eq(appeals.id, input.appealId));
  if (!row || row.appeal.status !== "open") throw new AppError("not_found");
  const others = await otherStaffAvailable(row.action.actorId);
  assertCan(actor, "appeal.decide", {
    type: "appeal",
    appellantId: row.appeal.appellantId,
    originalActorId: row.action.actorId,
    otherStaffAvailable: others,
  });
  const sameStaff = row.action.actorId === actor.id;
  const [appellant] = await db
    .select({ email: users.email, name: users.name, locale: userProfiles.locale })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, row.appeal.appellantId));
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .update(appeals)
      .set({
        status: input.outcome,
        decidedBy: actor.id,
        decisionText: input.decision,
        decidedAt: new Date(),
        decidedBySameStaff: sameStaff,
      })
      .where(eq(appeals.id, input.appealId));
    if (input.outcome === "reversed") await undoAction(tx, actor.id, row.action, input.decision);
    await tx.insert(notifications).values({
      userId: row.appeal.appellantId,
      type: "appeal_decided",
      payload: { actionId: row.action.id, outcome: input.outcome },
    });
    if (appellant) {
      const prefix = appellant.locale === "en" ? "/en" : "";
      const outcome =
        appellant.locale === "en"
          ? input.outcome === "reversed"
            ? "the decision was reversed"
            : "the decision stands"
          : input.outcome === "reversed"
            ? "avgjørelsen er omgjort"
            : "avgjørelsen står ved lag";
      await queueEmail(tx, {
        toEmail: appellant.email,
        toUserId: row.appeal.appellantId,
        template: "appeal_decided",
        locale: appellant.locale,
        payload: {
          name: appellant.name,
          outcome,
          decision: input.decision,
          url: `${env().APP_URL}${prefix}/moderering/${row.action.id}`,
        },
      });
    }
    await recordAudit(tx, {
      actorId: actor.id,
      action: "moderation.appeal_decided",
      targetType: "appeal",
      targetId: input.appealId,
      reason: input.outcome,
      metadata: { sameStaff },
      meta,
    });
  });
}

/** What a reversed appeal undoes (P03-03). A warning has nothing to undo; the record shows the reversal. */
async function undoAction(tx: Tx, staffId: string, a: typeof moderationActions.$inferSelect, decision: string) {
  const restore = (action: (typeof moderationActions.$inferInsert)["action"]) =>
    tx.insert(moderationActions).values({
      actorId: staffId,
      targetType: a.targetType,
      targetId: a.targetId,
      action,
      reasonCode: "appeal_reversed",
      statementOfReasons: decision,
    });
  if (a.action === "listing_hidden") {
    // Restored as paused; the owner decides when to show it again.
    await tx.update(listings).set({ status: "paused", updatedAt: new Date() }).where(eq(listings.id, a.targetId));
    await restore("listing_restored");
  } else if (a.action === "user_restricted" || a.action === "user_suspended") {
    await tx
      .update(userProfiles)
      .set({ status: "active", statusReasonCode: null, statusChangedAt: new Date() })
      .where(and(eq(userProfiles.userId, a.targetId), inArray(userProfiles.status, ["restricted", "suspended"])));
    await restore("user_reinstated");
  } else if (a.action === "review_removed") {
    // Back to where it was: published, or still sealed if it was removed before publication (P03-02).
    await tx
      .update(reviews)
      .set({ status: sql`CASE WHEN ${reviews.publishedAt} IS NULL THEN 'sealed' ELSE 'published' END` })
      .where(and(eq(reviews.id, a.targetId), eq(reviews.status, "removed")));
    await restore("review_restored");
  }
}

export async function adminCounts(actor: Actor) {
  assertCan(actor, "admin.access");
  const [r] = await db
    .execute<{
      users: number;
      listings: number;
      open_reports: number;
      open_appeals: number;
      outbox_pending: number;
      outbox_failed: number;
    }>(
      // Counts only, no personal data (ARCHITECTURE.md §7).
      sqlCounts,
    )
    .then((res) => res.rows);
  return r!;
}

const sqlCounts = sql`
  SELECT
    (SELECT count(*)::int FROM user_profiles WHERE status <> 'deleted') AS users,
    (SELECT count(*)::int FROM listings WHERE status = 'published' AND NOT is_demo) AS listings,
    (SELECT count(*)::int FROM reports WHERE status IN ('open','in_review')) AS open_reports,
    (SELECT count(*)::int FROM appeals WHERE status = 'open') AS open_appeals,
    (SELECT count(*)::int FROM email_outbox WHERE status = 'pending') AS outbox_pending,
    (SELECT count(*)::int FROM email_outbox WHERE status = 'failed') AS outbox_failed`;

export async function canSeeAdmin(actor: Actor): Promise<boolean> {
  return can(actor, "admin.access").allow;
}

export async function listRecentModeration(actor: Actor) {
  assertCan(actor, "report.handle");
  return db.select().from(moderationActions).orderBy(desc(moderationActions.createdAt)).limit(50);
}

/** For the owner of a hidden listing: the latest decision about it (link to reasons + appeal). */
export async function latestDecisionForOwnListing(actor: Actor, listingId: string): Promise<string | null> {
  if (actor.kind !== "user") return null;
  const [row] = await db
    .select({ id: moderationActions.id })
    .from(moderationActions)
    .innerJoin(listings, eq(listings.id, moderationActions.targetId))
    .where(
      and(
        eq(moderationActions.targetType, "listing"),
        eq(moderationActions.targetId, listingId),
        eq(moderationActions.action, "listing_hidden"),
        eq(listings.ownerId, actor.id),
      ),
    )
    .orderBy(desc(moderationActions.createdAt))
    .limit(1);
  return row?.id ?? null;
}
