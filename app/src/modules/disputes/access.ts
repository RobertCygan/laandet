import { and, desc, eq, gt } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { disputeEvents, disputes, supportAccessGrants } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor } from "@/modules/authz/actor-types";
import { can } from "@/modules/authz/policy";
import { getRequestMeta } from "@/modules/server/request-meta";

/**
 * Time-boxed staff access to private material (AUTH_MODEL §5). A grant is checked at read time;
 * it is never assumed from the role alone.
 */
export async function activeGrant(
  conn: DbOrTx,
  staffId: string,
  scope: "dispute" | "report_messages" | "condition_report",
  targetId: string,
  now = new Date(),
) {
  const [g] = await conn
    .select()
    .from(supportAccessGrants)
    .where(
      and(
        eq(supportAccessGrants.staffId, staffId),
        eq(supportAccessGrants.scope, scope),
        eq(supportAccessGrants.targetId, targetId),
        gt(supportAccessGrants.expiresAt, now),
      ),
    )
    .orderBy(desc(supportAccessGrants.expiresAt))
    .limit(1);
  return g ?? null;
}

/**
 * Staff may see a case's photos, or the condition photos of its booking, only with an active grant for
 * that case. Every such view is audited (`staff.view_media`).
 */
export async function staffMediaGrant(
  actor: Actor,
  disputeIds: { id: string; openedBy: string; respondentId: string }[],
  mediaId: string,
) {
  if (actor.kind !== "user") return false;
  for (const d of disputeIds) {
    if (!can(actor, "dispute.support", { type: "dispute", openerId: d.openedBy, respondentId: d.respondentId }).allow)
      continue;
    const g = await activeGrant(db, actor.id, "dispute", d.id);
    if (!g) continue;
    await recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "staff.view_media",
      targetType: "media",
      targetId: mediaId,
      reason: g.reason,
      metadata: { disputeId: d.id },
      meta: await getRequestMeta(),
    });
    return true;
  }
  return false;
}

/** Case photos (scope `dispute`): the two parties; before attaching, only the uploader; staff with a grant. */
export async function mayViewDisputeMedia(actor: Actor, mediaId: string, uploadedBy: string | null) {
  if (actor.kind !== "user") return false;
  const [row] = await db
    .select({ id: disputes.id, openedBy: disputes.openedBy, respondentId: disputes.respondentId })
    .from(disputeEvents)
    .innerJoin(disputes, eq(disputes.id, disputeEvents.disputeId))
    .where(eq(disputeEvents.mediaId, mediaId));
  if (!row) return actor.id === uploadedBy;
  if (actor.id === row.openedBy || actor.id === row.respondentId) return true;
  return staffMediaGrant(actor, [row], mediaId);
}
