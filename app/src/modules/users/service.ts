import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, listings, localities, userProfiles, users } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import { displayNameSchema } from "@/modules/auth/schemas";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { isFlagEnabled } from "@/modules/flags/flags";
import { completedRentalCount, listPublishedReviews, ratingSummary } from "@/modules/reviews/service";
import { getRequestMeta } from "@/modules/server/request-meta";

export const profileSchema = z.object({
  name: displayNameSchema,
  locality: z
    .string()
    .max(60)
    .optional()
    .transform((v) => (v ? v : null)),
  bio: z
    .string()
    .trim()
    .max(500, { error: "too_long" })
    .optional()
    .transform((v) => (v ? v : null)),
  locale: z.enum(["nb", "en"]),
  emailNotifications: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export async function updateProfile(actor: Actor, input: ProfileInput): Promise<void> {
  assertCan(actor, "profile.update", { type: "profile", userId: actor.kind === "user" ? actor.id : "" });
  let localityId: string | null = null;
  if (input.locality) {
    const [loc] = await db.select({ id: localities.id }).from(localities).where(eq(localities.slug, input.locality));
    localityId = loc?.id ?? null;
  }
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: input.name, updatedAt: new Date() }).where(eq(users.id, actor.id));
    await tx
      .update(userProfiles)
      .set({
        localityId,
        bio: input.bio,
        locale: input.locale,
        emailNotifications: input.emailNotifications,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, actor.id));
    // Only the fact of the change is logged, never the values.
    await recordAudit(tx, {
      actorId: actor.id,
      action: "profile.update",
      targetType: "user",
      targetId: actor.id,
      meta,
    });
  });
}

export async function getOwnProfile(actor: Actor) {
  if (actor.kind !== "user") return null;
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      twoFactorEnabled: users.twoFactorEnabled,
      createdAt: users.createdAt,
      bio: userProfiles.bio,
      locale: userProfiles.locale,
      emailNotifications: userProfiles.emailNotifications,
      status: userProfiles.status,
      role: userProfiles.role,
      localitySlug: localities.slug,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(localities, eq(localities.id, userProfiles.localityId))
    .where(eq(users.id, actor.id));
  return row ?? null;
}

/** Public profile: only real data, never email (master spec §8). */
export async function getPublicProfile(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const [p] = await db
    .select({
      id: users.id,
      name: users.name,
      createdAt: users.createdAt,
      bio: userProfiles.bio,
      status: userProfiles.status,
      localityName: localities.name,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(localities, eq(localities.id, userProfiles.localityId))
    .where(eq(users.id, userId));
  if (!p || !["active", "restricted"].includes(p.status)) return null;
  const showDemo = await isFlagEnabled(db, "show_demo_listings");
  const active = await db
    .select({
      id: listings.id,
      title: listings.title,
      type: listings.type,
      labels: categories.labels,
      isDemo: listings.isDemo,
    })
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(
      and(
        eq(listings.ownerId, userId),
        inArray(listings.status, ["published"]),
        isNull(listings.deletedAt),
        ...(showDemo ? [] : [eq(listings.isDemo, false)]),
      ),
    )
    .orderBy(desc(listings.publishedAt))
    .limit(24);
  // Real statistics only (master spec §8): completed rentals and published reviews, never estimates.
  const [completedRentals, summary, publishedReviews] = await Promise.all([
    completedRentalCount(userId),
    ratingSummary(userId),
    listPublishedReviews(userId),
  ]);
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    bio: p.bio,
    localityName: p.localityName,
    activeListings: active,
    completedRentals,
    ratings: summary,
    reviews: publishedReviews,
    identityVerified: false,
  };
}
