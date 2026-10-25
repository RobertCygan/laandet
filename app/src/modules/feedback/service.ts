import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { FEEDBACK_KINDS, feedback, users } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta } from "@/modules/server/request-meta";

/**
 * «Gi tilbakemelding» (P04-01): what beta testers and members tell us, in one place for staff. The page it
 * came from is kept as a path only (no query string, which could hold a token).
 */
export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS, { error: "required" }),
  body: z.string().trim().min(3, { error: "required" }).max(2000, { error: "too_long" }),
  pagePath: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      const path = v?.split(/[?#]/)[0];
      return path && /^\/[\w\-/.]{0,299}$/.test(path) ? path : null;
    }),
});

export async function sendFeedback(actor: Actor, input: z.infer<typeof feedbackSchema>): Promise<void> {
  assertCan(actor, "feedback.create");
  await enforceRateLimits(db, [{ bucket: `feedback:user:${actor.id}`, rule: LIMITS.feedback }]);
  await db.insert(feedback).values({ userId: actor.id, kind: input.kind, body: input.body, pagePath: input.pagePath });
}

/** Staff list: open items first, then the latest handled ones. Only the sender's display name is shown. */
export async function listFeedback(actor: Actor) {
  assertCan(actor, "feedback.handle");
  const rows = await db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      body: feedback.body,
      pagePath: feedback.pagePath,
      status: feedback.status,
      createdAt: feedback.createdAt,
      handledAt: feedback.handledAt,
      senderName: users.name,
    })
    .from(feedback)
    .innerJoin(users, eq(users.id, feedback.userId))
    .orderBy(desc(feedback.createdAt))
    .limit(300);
  return { open: rows.filter((r) => r.status === "open"), handled: rows.filter((r) => r.status === "handled") };
}

export async function markFeedbackHandled(actor: Actor, feedbackId: string): Promise<void> {
  assertCan(actor, "feedback.handle");
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(feedback)
      .set({ status: "handled", handledBy: actor.id, handledAt: new Date() })
      .where(and(eq(feedback.id, feedbackId), eq(feedback.status, "open")))
      .returning({ id: feedback.id });
    if (!updated.length) throw new AppError("not_found");
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "feedback.handled",
      targetType: "feedback",
      targetId: feedbackId,
      meta,
    });
  });
}
