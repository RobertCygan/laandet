import { and, asc, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { CATEGORY_POLICIES, LISTING_TYPES, categories, listings, localities } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { getRequestMeta } from "@/modules/server/request-meta";

/** Every admin change carries a reason that ends up in the audit log (SEC-50/51). */
export const reasonSchema = z.string().trim().min(10, { error: "reason_length" }).max(500, { error: "reason_length" });

const checkbox = z
  .union([z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === "on");

// ---------------------------------------------------------------- categories

/** All categories with the number of published listings in each (to see what a policy change affects). */
export async function listCategoriesForAdmin(actor: Actor) {
  assertCan(actor, "category.policy");
  const counts = await db
    .select({ categoryId: listings.categoryId, n: count() })
    .from(listings)
    .where(and(eq(listings.status, "published"), isNull(listings.deletedAt)))
    .groupBy(listings.categoryId);
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.slug));
  return rows.map((c) => ({ ...c, publishedListings: counts.find((x) => x.categoryId === c.id)?.n ?? 0 }));
}

export const categoryPolicySchema = z.object({
  categoryId: z.uuid(),
  policy: z.enum(CATEGORY_POLICIES, { error: "required" }),
  reason: reasonSchema,
});

/** Moderators and admins: allowed / restricted / prohibited. Listings already published are not hidden. */
export async function updateCategoryPolicy(actor: Actor, input: z.infer<typeof categoryPolicySchema>): Promise<void> {
  assertCan(actor, "category.policy");
  const [c] = await db.select().from(categories).where(eq(categories.id, input.categoryId));
  if (!c) throw new AppError("not_found");
  if (c.policy === input.policy) return;
  // A restricted category always shows a safety notice; only an admin can write one.
  if (input.policy === "restricted" && !c.safetyNotice)
    throw new AppError("validation", "safety_notice_required", { fieldErrors: { policy: "safety_notice_required" } });
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(categories).set({ policy: input.policy, updatedAt: new Date() }).where(eq(categories.id, c.id));
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "category.updated",
      targetType: "category",
      targetId: c.id,
      reason: input.reason,
      metadata: { slug: c.slug, changed: ["policy"], policy: { from: c.policy, to: input.policy } },
      meta,
    });
  });
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "too_long" })
    .optional()
    .transform((v) => v || "");

export const categorySchema = z
  .object({
    categoryId: z.uuid(),
    labelNb: z.string().trim().min(2, { error: "required" }).max(60, { error: "too_long" }),
    labelEn: z.string().trim().min(2, { error: "required" }).max(60, { error: "too_long" }),
    safetyNb: optionalText(600),
    safetyEn: optionalText(600),
    policy: z.enum(CATEGORY_POLICIES, { error: "required" }),
    types: z.array(z.enum(LISTING_TYPES)).min(1, { error: "types_required" }),
    allowPaidRental: checkbox,
    active: checkbox,
    sortOrder: z.coerce.number().int().min(0, { error: "sort_order_range" }).max(999, { error: "sort_order_range" }),
    reason: reasonSchema,
  })
  .superRefine((v, ctx) => {
    if (Boolean(v.safetyNb) !== Boolean(v.safetyEn))
      ctx.addIssue({ code: "custom", path: ["safetyNb"], message: "safety_both_languages" });
    if (v.policy === "restricted" && !v.safetyNb)
      ctx.addIssue({ code: "custom", path: ["safetyNb"], message: "safety_notice_required" });
  });

/** Admins: labels, safety notice, listing types, paid rental (D-028), order, active, policy. Slug never changes. */
export async function updateCategory(actor: Actor, input: z.infer<typeof categorySchema>): Promise<void> {
  assertCan(actor, "category.manage");
  const [c] = await db.select().from(categories).where(eq(categories.id, input.categoryId));
  if (!c) throw new AppError("not_found");
  const next = {
    labels: { nb: input.labelNb, en: input.labelEn },
    safetyNotice: input.safetyNb ? { nb: input.safetyNb, en: input.safetyEn } : null,
    policy: input.policy,
    allowedListingTypes: [...new Set(input.types)],
    allowPaidRental: input.allowPaidRental,
    active: input.active,
    sortOrder: input.sortOrder,
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
    (k) => JSON.stringify(next[k]) !== JSON.stringify(c[k]),
  );
  if (!changed.length) return;
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(categories.id, c.id));
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "category.updated",
      targetType: "category",
      targetId: c.id,
      reason: input.reason,
      // Field names and the flags that matter for safety; label texts are in the table itself.
      metadata: {
        slug: c.slug,
        changed,
        policy: { from: c.policy, to: next.policy },
        allowPaidRental: next.allowPaidRental,
        active: next.active,
      },
      meta,
    });
  });
}

// ---------------------------------------------------------------- localities

export async function listLocalitiesForAdmin(actor: Actor) {
  assertCan(actor, "locality.manage");
  return db.select().from(localities).orderBy(asc(localities.sortOrder), asc(localities.name));
}

const localityName = z.string().trim().min(2, { error: "required" }).max(60, { error: "too_long" });

export const createLocalitySchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,40}$/, { error: "slug_format" }),
  name: localityName,
  municipality: localityName,
  sortOrder: z.coerce.number().int().min(0, { error: "sort_order_range" }).max(999, { error: "sort_order_range" }),
  reason: reasonSchema,
});

export async function createLocality(actor: Actor, input: z.infer<typeof createLocalitySchema>): Promise<string> {
  assertCan(actor, "locality.manage");
  const [exists] = await db.select({ id: localities.id }).from(localities).where(eq(localities.slug, input.slug));
  if (exists) throw new AppError("validation", "slug_taken", { fieldErrors: { slug: "slug_taken" } });
  const meta = await getRequestMeta();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(localities)
      .values({ slug: input.slug, name: input.name, municipality: input.municipality, sortOrder: input.sortOrder })
      .returning({ id: localities.id });
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "locality.created",
      targetType: "locality",
      targetId: row!.id,
      reason: input.reason,
      metadata: { slug: input.slug, name: input.name },
      meta,
    });
    return row!.id;
  });
}

export const updateLocalitySchema = z.object({
  localityId: z.uuid(),
  name: localityName,
  municipality: localityName,
  active: checkbox,
  sortOrder: z.coerce.number().int().min(0, { error: "sort_order_range" }).max(999, { error: "sort_order_range" }),
  reason: reasonSchema,
});

/** Rename, reorder or deactivate. The slug never changes (it is in shared URLs). */
export async function updateLocality(actor: Actor, input: z.infer<typeof updateLocalitySchema>): Promise<void> {
  assertCan(actor, "locality.manage");
  const [l] = await db.select().from(localities).where(eq(localities.id, input.localityId));
  if (!l) throw new AppError("not_found");
  const next = { name: input.name, municipality: input.municipality, active: input.active, sortOrder: input.sortOrder };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== l[k]);
  if (!changed.length) return;
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(localities).set(next).where(eq(localities.id, l.id));
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "locality.updated",
      targetType: "locality",
      targetId: l.id,
      reason: input.reason,
      metadata: { slug: l.slug, changed, active: next.active },
      meta,
    });
  });
}
