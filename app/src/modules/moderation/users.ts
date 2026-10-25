import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import { moderationActions, notifications, reports, sessions, userProfiles, users } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { env } from "@/modules/config/env";
import { AppError } from "@/modules/errors";
import { queueEmail } from "@/modules/notifications/outbox";
import { getRequestMeta } from "@/modules/server/request-meta";
import { assertNotOwnCase, assertReportAbout } from "./service";

/**
 * Account measures (P03-03, AUTH_MODEL §3): warn, restrict (optionally until a date), suspend, reinstate.
 * A safety tool with a statement of reasons and a right to appeal — never a penalty for losing an argument.
 */
export const USER_MEASURES = ["warn", "restrict", "suspend", "reinstate"] as const;
export type UserMeasure = (typeof USER_MEASURES)[number];
const ACTION_OF = {
  warn: "user_warned",
  restrict: "user_restricted",
  suspend: "user_suspended",
  reinstate: "user_reinstated",
} as const;
const STATUS_OF = { restrict: "restricted", suspend: "suspended", reinstate: "active" } as const;

export const USER_REASONS = [
  "fraud_or_scam",
  "harassment",
  "not_returned",
  "unsafe",
  "spam",
  "illegal_content",
  "repeated_violations",
  "other",
] as const;

export const userMeasureSchema = z.object({
  userId: z.uuid(),
  measure: z.enum(USER_MEASURES),
  reasonCode: z.enum(USER_REASONS, { error: "required" }),
  statement: z.string().trim().min(10, { error: "statement_too_short" }).max(4000, { error: "too_long" }),
  reportId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  until: z.iso
    .datetime({ offset: true, error: "date_invalid" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

async function tellUser(tx: Tx, userId: string, actionId: string, statement: string, measure: UserMeasure) {
  await tx.insert(notifications).values({ userId, type: "account_measure", payload: { actionId, measure } });
  const [u] = await tx
    .select({ email: users.email, name: users.name, locale: userProfiles.locale })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, userId));
  if (!u) return;
  const prefix = u.locale === "en" ? "/en" : "";
  await queueEmail(tx, {
    toEmail: u.email,
    toUserId: userId,
    template: "account_measure",
    locale: u.locale,
    payload: { name: u.name, measure, statement, url: `${env().APP_URL}${prefix}/moderering/${actionId}` },
  });
}

/** Applies one measure. Suspension revokes every session at once (SEC-12). */
export async function applyUserMeasure(
  actor: Actor,
  input: z.infer<typeof userMeasureSchema>,
  now = new Date(),
): Promise<{ actionId: string }> {
  assertCan(actor, "user.moderate", { type: "profile", userId: input.userId });
  const [target] = await db
    .select({ status: userProfiles.status, role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.userId, input.userId));
  if (!target || target.status === "deleted" || target.status === "deletion_pending") throw new AppError("not_found");
  // Only an admin may act on a staff account.
  if (target.role !== "user" && actor.role !== "admin") throw new AppError("forbidden");
  if (input.measure === "reinstate" && target.status === "active") throw new AppError("conflict", "already_active");
  if (input.measure !== "restrict" && input.until) throw new AppError("validation", "measure_invalid");
  const until = input.until ? new Date(input.until) : null;
  if (until && until <= now)
    throw new AppError("validation", "measure_invalid", { fieldErrors: { until: "period_in_past" } });
  if (input.reportId) {
    const [r] = await db.select().from(reports).where(eq(reports.id, input.reportId));
    if (!r || r.status === "actioned" || r.status === "dismissed") throw new AppError("not_found");
    await assertNotOwnCase(actor as UserActor, r);
    await assertReportAbout(r, input.userId);
  }
  const meta = await getRequestMeta();
  return db.transaction(async (tx) => {
    if (input.measure !== "warn") {
      await tx
        .update(userProfiles)
        .set({ status: STATUS_OF[input.measure], statusReasonCode: input.reasonCode, statusChangedAt: now })
        .where(eq(userProfiles.userId, input.userId));
    }
    if (input.measure === "suspend") await tx.delete(sessions).where(eq(sessions.userId, input.userId));
    const [action] = await tx
      .insert(moderationActions)
      .values({
        actorId: actor.id,
        targetType: "user",
        targetId: input.userId,
        action: ACTION_OF[input.measure],
        reasonCode: input.reasonCode,
        statementOfReasons: input.statement,
        reportId: input.reportId ?? null,
        expiresAt: until,
      })
      .returning({ id: moderationActions.id });
    if (input.reportId) {
      await tx
        .update(reports)
        .set({ status: "actioned", handledBy: actor.id, handledAt: now, decisionNote: ACTION_OF[input.measure] })
        .where(eq(reports.id, input.reportId));
    }
    await tellUser(tx, input.userId, action!.id, input.statement, input.measure);
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: (actor as UserActor).role,
      action: `moderation.${ACTION_OF[input.measure]}`,
      targetType: "user",
      targetId: input.userId,
      reason: input.reasonCode,
      metadata: { moderationActionId: action!.id, reportId: input.reportId ?? null, until: until?.toISOString() },
      meta,
    });
    return { actionId: action!.id };
  });
}

/**
 * Worker job `restriction_expiry`: a restriction with an end date ends by itself. Only accounts whose
 * latest measure is that restriction are reinstated (a later suspension stays). Audited as system.
 */
export async function expireRestrictions(now = new Date()): Promise<number> {
  const due = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.status, "restricted"),
        sql`(SELECT m.expires_at FROM moderation_actions m
             WHERE m.target_type = 'user' AND m.target_id = ${userProfiles.userId}
               AND m.action IN ('user_restricted','user_suspended','user_reinstated')
             ORDER BY m.created_at DESC LIMIT 1) < ${now.toISOString()}::timestamptz`,
      ),
    )
    .limit(200);
  let done = 0;
  for (const { userId } of due) {
    const moved = await db.transaction(async (tx) => {
      const updated = await tx
        .update(userProfiles)
        .set({ status: "active", statusReasonCode: null, statusChangedAt: now })
        .where(and(eq(userProfiles.userId, userId), eq(userProfiles.status, "restricted")))
        .returning({ id: userProfiles.userId });
      if (!updated.length) return false;
      await tx.insert(notifications).values({ userId, type: "restriction_ended", payload: {} });
      await recordAudit(tx, {
        actorId: null,
        action: "moderation.restriction_expired",
        targetType: "user",
        targetId: userId,
      });
      return true;
    });
    if (moved) done++;
  }
  return done;
}

/** The latest measures about a user, for the staff view of a profile report. */
export async function measuresForUser(actor: Actor, userId: string) {
  assertCan(actor, "report.handle");
  return db
    .select({
      id: moderationActions.id,
      action: moderationActions.action,
      createdAt: moderationActions.createdAt,
      expiresAt: moderationActions.expiresAt,
    })
    .from(moderationActions)
    .where(
      and(
        eq(moderationActions.targetType, "user"),
        eq(moderationActions.targetId, userId),
        inArray(moderationActions.action, ["user_warned", "user_restricted", "user_suspended", "user_reinstated"]),
      ),
    )
    .orderBy(desc(moderationActions.createdAt))
    .limit(10);
}
