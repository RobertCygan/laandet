import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { transparencyMonths } from "@/db/schema";
import { parseKrToOre } from "@/i18n/format";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { getRequestMeta } from "@/modules/server/request-meta";
import { reasonSchema } from "./catalog";

/** «Åpenhet» (P03-07): real monthly figures from invoices and payout statements, entered by the owner. */
const PUBLIC_COLUMNS = {
  month: transparencyMonths.month,
  costTotalOre: transparencyMonths.costTotalOre,
  costServerOre: transparencyMonths.costServerOre,
  costBackupOre: transparencyMonths.costBackupOre,
  costEmailOre: transparencyMonths.costEmailOre,
  costDomainOre: transparencyMonths.costDomainOre,
  costOtherOre: transparencyMonths.costOtherOre,
  supportReceivedOre: transparencyMonths.supportReceivedOre,
  note: transparencyMonths.note,
};

/** Public: the entered months, newest first. Never the internal source note or who entered them. */
export async function listTransparencyMonths() {
  return db.select(PUBLIC_COLUMNS).from(transparencyMonths).orderBy(desc(transparencyMonths.month));
}

export type TransparencyMonth = Awaited<ReturnType<typeof listTransparencyMonths>>[number];

/** Admin: the same rows plus the internal source note. */
export async function listTransparencyForAdmin(actor: Actor) {
  assertCan(actor, "transparency.manage");
  return db
    .select({ ...PUBLIC_COLUMNS, id: transparencyMonths.id, sourceNote: transparencyMonths.sourceNote })
    .from(transparencyMonths)
    .orderBy(desc(transparencyMonths.month));
}

const kr = (required: boolean) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) {
        if (required) ctx.addIssue({ code: "custom", message: "required" });
        return null;
      }
      const ore = parseKrToOre(v);
      if (ore === null || ore > 100_000_000_00) {
        ctx.addIssue({ code: "custom", message: "amount_invalid" });
        return null;
      }
      return ore;
    });

const PARTS = ["costServerOre", "costBackupOre", "costEmailOre", "costDomainOre", "costOtherOre"] as const;

export const transparencySchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "month_invalid" }),
    costTotalOre: kr(true),
    costServerOre: kr(false),
    costBackupOre: kr(false),
    costEmailOre: kr(false),
    costDomainOre: kr(false),
    costOtherOre: kr(false),
    supportReceivedOre: kr(false),
    note: z.string().trim().max(500, { error: "too_long" }).optional().default(""),
    sourceNote: z.string().trim().max(500, { error: "too_long" }).optional().default(""),
    reason: reasonSchema,
  })
  .superRefine((v, ctx) => {
    const parts = PARTS.reduce((sum, k) => sum + (v[k] ?? 0), 0);
    if (v.costTotalOre !== null && parts > v.costTotalOre)
      ctx.addIssue({ code: "custom", path: ["costTotalOre"], message: "parts_exceed_total" });
  });

export type TransparencyInput = z.infer<typeof transparencySchema>;

/** Adds or corrects one month (one row per month). Figures for a month that has not started are refused. */
export async function saveTransparencyMonth(actor: Actor, input: TransparencyInput, now = new Date()): Promise<void> {
  assertCan(actor, "transparency.manage");
  const monthStart = `${input.month}-01`;
  const current = now.toISOString().slice(0, 7);
  if (input.month > current)
    throw new AppError("validation", "month_in_future", { fieldErrors: { month: "month_in_future" } });
  const values = {
    costTotalOre: input.costTotalOre!,
    costServerOre: input.costServerOre,
    costBackupOre: input.costBackupOre,
    costEmailOre: input.costEmailOre,
    costDomainOre: input.costDomainOre,
    costOtherOre: input.costOtherOre,
    supportReceivedOre: input.supportReceivedOre,
    note: input.note || null,
    sourceNote: input.sourceNote || null,
    enteredBy: actor.id,
    updatedAt: now,
  };
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transparencyMonths)
      .values({ month: monthStart, ...values })
      .onConflictDoUpdate({ target: transparencyMonths.month, set: values })
      .returning({ id: transparencyMonths.id });
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "transparency.saved",
      targetType: "transparency_month",
      targetId: row!.id,
      reason: input.reason,
      metadata: {
        month: input.month,
        costTotalOre: values.costTotalOre,
        supportReceivedOre: values.supportReceivedOre,
      },
      meta,
    });
  });
}

export const removeTransparencySchema = z.object({ monthId: z.uuid(), reason: reasonSchema });

/** Removes a month entered by mistake (audited with the figures that were removed). */
export async function removeTransparencyMonth(
  actor: Actor,
  input: z.infer<typeof removeTransparencySchema>,
): Promise<void> {
  assertCan(actor, "transparency.manage");
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(transparencyMonths).where(eq(transparencyMonths.id, input.monthId)).returning();
    if (!row) throw new AppError("not_found");
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "transparency.removed",
      targetType: "transparency_month",
      targetId: row.id,
      reason: input.reason,
      metadata: { month: row.month.slice(0, 7), costTotalOre: row.costTotalOre },
      meta,
    });
  });
}
