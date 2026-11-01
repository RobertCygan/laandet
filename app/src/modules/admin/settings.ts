import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditEvents, featureFlags, legalDocumentVersions, users } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { FLAG_DEFAULTS, type FlagKey } from "@/modules/flags/flags";
import { getRequestMeta } from "@/modules/server/request-meta";
import { reasonSchema } from "./catalog";

// ---------------------------------------------------------------- feature flags

const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as [FlagKey, ...FlagKey[]];

/** Every known flag with its current value (the default until someone changed it). */
export async function listFlags(actor: Actor) {
  assertCan(actor, "flag.manage");
  const rows = await db
    .select({
      key: featureFlags.key,
      enabled: featureFlags.enabled,
      updatedAt: featureFlags.updatedAt,
      updatedByName: users.name,
    })
    .from(featureFlags)
    .leftJoin(users, eq(users.id, featureFlags.updatedBy));
  return FLAG_KEYS.map((key) => {
    const row = rows.find((r) => r.key === key);
    return {
      key,
      enabled: row?.enabled ?? FLAG_DEFAULTS[key].enabled,
      isDefault: !row,
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedByName ?? null,
    };
  });
}

export const flagSchema = z.object({
  key: z.enum(FLAG_KEYS),
  enabled: z.enum(["true", "false"]).transform((v) => v === "true"),
  reason: reasonSchema,
});

/** Admins switch a flag with a reason (audited as `flag.updated`). This is where `rentals_open` is opened. */
export async function setFlag(actor: Actor, input: z.infer<typeof flagSchema>): Promise<void> {
  assertCan(actor, "flag.manage");
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.key, input.key));
    const from = before?.enabled ?? FLAG_DEFAULTS[input.key].enabled;
    const now = new Date();
    await tx
      .insert(featureFlags)
      .values({
        key: input.key,
        enabled: input.enabled,
        description: FLAG_DEFAULTS[input.key].description,
        updatedBy: actor.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: { enabled: input.enabled, updatedBy: actor.id, updatedAt: now },
      });
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "flag.updated",
      targetType: "feature_flag",
      reason: input.reason,
      metadata: { key: input.key, from, to: input.enabled },
      meta,
    });
  });
}

// ---------------------------------------------------------------- legal versions (read-only)

/**
 * Every loaded version per document and language, newest first. Read-only: texts are loaded with
 * `npm run legal:load`, and nothing here can mark a text as legally reviewed.
 */
export async function listLegalVersions(actor: Actor) {
  assertCan(actor, "legal.view");
  const rows = await db
    .select({
      id: legalDocumentVersions.id,
      docKey: legalDocumentVersions.docKey,
      locale: legalDocumentVersions.locale,
      version: legalDocumentVersions.version,
      isDraft: legalDocumentVersions.isDraft,
      isAuthoritative: legalDocumentVersions.isAuthoritative,
      materialChange: legalDocumentVersions.materialChange,
      contentSha256: legalDocumentVersions.contentSha256,
      effectiveAt: legalDocumentVersions.effectiveAt,
      createdAt: legalDocumentVersions.createdAt,
    })
    .from(legalDocumentVersions)
    .orderBy(
      asc(legalDocumentVersions.docKey),
      asc(legalDocumentVersions.locale),
      desc(legalDocumentVersions.createdAt),
    );
  // The current version is the newest per document and language (same rule as the public pages).
  const seen = new Set<string>();
  return rows.map((r) => {
    const k = `${r.docKey}:${r.locale}`;
    const current = !seen.has(k);
    seen.add(k);
    return { ...r, current };
  });
}

// ---------------------------------------------------------------- security log (read-only)

export const AUDIT_LIMIT = 200;
const prefixSchema = z
  .string()
  .trim()
  .regex(/^[a-z_.]{1,40}$/)
  .optional()
  .catch(undefined);

/**
 * The newest audit events (admin only), optionally by action prefix. IPs exist only as HMAC hashes,
 * and the metadata never holds message text, emails or secrets (SEC-43).
 */
export async function listAuditEvents(actor: Actor, opts: { prefix?: string } = {}) {
  assertCan(actor, "audit.view");
  const prefix = prefixSchema.parse(opts.prefix);
  return db
    .select({
      id: auditEvents.id,
      occurredAt: auditEvents.occurredAt,
      action: auditEvents.action,
      actorId: auditEvents.actorId,
      actorRole: auditEvents.actorRole,
      actorName: users.name,
      targetType: auditEvents.targetType,
      targetId: auditEvents.targetId,
      reason: auditEvents.reason,
      requestId: auditEvents.requestId,
      ipHash: auditEvents.ipHash,
      metadata: auditEvents.metadata,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(prefix ? sql`starts_with(${auditEvents.action}, ${prefix})` : undefined)
    .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
    .limit(AUDIT_LIMIT);
}
