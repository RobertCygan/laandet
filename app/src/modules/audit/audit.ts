import type { DbOrTx } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { hashIp, type RequestMeta } from "@/modules/server/request-meta";

export type AuditInput = {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  meta?: RequestMeta | null;
};

/**
 * Append an audit event (runtime role can only INSERT). Never put message bodies,
 * emails, addresses or secrets into metadata (SEC-43).
 */
export async function recordAudit(db: DbOrTx, input: AuditInput): Promise<void> {
  await db.insert(auditEvents).values({
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    reason: input.reason ?? null,
    requestId: input.meta?.requestId ?? null,
    ipHash: hashIp(input.meta?.ip ?? null),
    metadata: input.metadata ?? {},
  });
}
