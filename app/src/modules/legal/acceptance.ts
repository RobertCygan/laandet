import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { legalAcceptances, legalDocumentVersions } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor } from "@/modules/authz/actor-types";
import { AppError } from "@/modules/errors";
import { getRequestMeta } from "@/modules/server/request-meta";
import { currentLegalDoc, type LegalDoc } from "./repo";

const ACCEPTED_DOCS = ["terms", "privacy"] as const;

/**
 * Terms/privacy versions the user must (re-)accept (P01-11 §6): a version marked as a material
 * change, with no acceptance by this user of that version or a later one. Norwegian is authoritative.
 */
export async function pendingAcceptances(actor: Actor): Promise<LegalDoc[]> {
  if (actor.kind !== "user") return [];
  const pending: LegalDoc[] = [];
  for (const docKey of ACCEPTED_DOCS) {
    const [material] = await db
      .select({ createdAt: legalDocumentVersions.createdAt })
      .from(legalDocumentVersions)
      .where(
        and(
          eq(legalDocumentVersions.docKey, docKey),
          eq(legalDocumentVersions.locale, "nb"),
          eq(legalDocumentVersions.materialChange, true),
        ),
      )
      .orderBy(desc(legalDocumentVersions.createdAt))
      .limit(1);
    if (!material) continue;
    const [accepted] = await db
      .select({ id: legalAcceptances.id })
      .from(legalAcceptances)
      .innerJoin(legalDocumentVersions, eq(legalDocumentVersions.id, legalAcceptances.documentVersionId))
      .where(
        and(
          eq(legalAcceptances.userId, actor.id),
          eq(legalDocumentVersions.docKey, docKey),
          eq(legalDocumentVersions.locale, "nb"),
          gte(legalDocumentVersions.createdAt, material.createdAt),
        ),
      )
      .limit(1);
    if (accepted) continue;
    const latest = await currentLegalDoc(db, docKey, "nb");
    if (latest) pending.push(latest);
  }
  return pending;
}

export async function assertNoPendingAcceptance(actor: Actor): Promise<void> {
  if ((await pendingAcceptances(actor)).length) throw new AppError("conflict", "terms_acceptance_required");
}

export const acceptSchema = z.object({ confirm: z.literal("on", { error: "must_confirm" }) });

/** Accept the current versions of everything pending (append-only rows + audit). */
export async function acceptPending(actor: Actor): Promise<void> {
  if (actor.kind !== "user") throw new AppError("auth_required");
  const pending = await pendingAcceptances(actor);
  if (!pending.length) return;
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    for (const doc of pending) {
      await tx.insert(legalAcceptances).values({ userId: actor.id, documentVersionId: doc.id }).onConflictDoNothing();
      await recordAudit(tx, {
        actorId: actor.id,
        action: "legal.accept",
        targetType: "legal_document",
        targetId: doc.id,
        metadata: { docKey: doc.docKey, version: doc.version },
        meta,
      });
    }
  });
}
