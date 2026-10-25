import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  categories,
  listingImages,
  listings,
  localities,
  savedListings,
  userProfiles,
  users,
  type ListingType,
  type LocalizedText,
  type PriceUnit,
} from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { can } from "@/modules/authz/policy";
import { isFlagEnabled } from "@/modules/flags/flags";

export type ListingSummary = {
  id: string;
  type: ListingType;
  title: string;
  isDemo: boolean;
  priceOre: number | null;
  priceUnit: PriceUnit | null;
  budgetOre: number | null;
  handoverOwnerDelivery: boolean;
  categoryLabels: LocalizedText;
  categoryIcon: string;
  localityName: string;
  thumbId: string | null;
  imageAlt: string | null;
};

export type SearchFilters = {
  q?: string;
  type?: ListingType;
  category?: string; // slug
  locality?: string; // slug
  minPriceOre?: number;
  maxPriceOre?: number;
  delivery?: Array<"pickup" | "owner_delivery" | "meet">;
  from?: string; // YYYY-MM-DD
  to?: string;
  sort?: "newest" | "price";
  page?: number;
};

export const PAGE_SIZE = 24;
const MAX_PAGE = 50;

/** Listings visible to the public: published, not deleted, owner account in good standing. */
function visibleConditions(showDemo: boolean): SQL[] {
  const c: SQL[] = [
    eq(listings.status, "published"),
    isNull(listings.deletedAt),
    inArray(userProfiles.status, ["active", "restricted"]),
  ];
  if (!showDemo) c.push(eq(listings.isDemo, false));
  return c;
}

const firstImage = sql<
  string | null
>`(SELECT li.media_id FROM listing_images li WHERE li.listing_id = ${listings.id} ORDER BY li.sort_order LIMIT 1)`;
const firstAlt = sql<
  string | null
>`(SELECT li.alt_text FROM listing_images li WHERE li.listing_id = ${listings.id} ORDER BY li.sort_order LIMIT 1)`;

const summaryColumns = {
  id: listings.id,
  type: listings.type,
  title: listings.title,
  isDemo: listings.isDemo,
  priceOre: listings.priceOre,
  priceUnit: listings.priceUnit,
  budgetOre: listings.budgetOre,
  handoverOwnerDelivery: listings.handoverOwnerDelivery,
  categoryLabels: categories.labels,
  categoryIcon: categories.icon,
  localityName: localities.name,
  thumbId: firstImage,
  imageAlt: firstAlt,
};

/** Explore page search (D-019). Ranking: newest first, or lowest price (stated publicly, L-03). */
export async function searchListings(f: SearchFilters): Promise<{ items: ListingSummary[]; hasMore: boolean }> {
  const showDemo = await isFlagEnabled(db, "show_demo_listings");
  const where = visibleConditions(showDemo);
  if (f.type) where.push(eq(listings.type, f.type));
  if (f.category) {
    where.push(
      sql`${listings.categoryId} IN (SELECT id FROM categories WHERE slug = ${f.category} OR parent_id = (SELECT id FROM categories WHERE slug = ${f.category}))`,
    );
  }
  if (f.locality) where.push(eq(localities.slug, f.locality));
  if (f.minPriceOre !== undefined) where.push(sql`${listings.priceOre} >= ${f.minPriceOre}`);
  if (f.maxPriceOre !== undefined) where.push(sql`${listings.priceOre} <= ${f.maxPriceOre}`);
  if (f.delivery?.length) {
    const opts: SQL[] = [];
    if (f.delivery.includes("pickup")) opts.push(eq(listings.handoverPickup, true));
    if (f.delivery.includes("owner_delivery")) opts.push(eq(listings.handoverOwnerDelivery, true));
    if (f.delivery.includes("meet")) opts.push(eq(listings.handoverMeet, true));
    where.push(sql`(${sql.join(opts, sql` OR `)})`);
  }
  if (f.from && f.to && f.to >= f.from) {
    // Exclude listings blocked in the requested period (bookings are added in Phase 02).
    where.push(sql`NOT EXISTS (
      SELECT 1 FROM listing_unavailability u WHERE u.listing_id = ${listings.id}
      AND u.period && tstzrange(${f.from}::date::timestamptz, (${f.to}::date + 1)::timestamptz, '[)'))`);
  }
  const q = f.q?.trim().slice(0, 100);
  if (q) {
    where.push(sql`(
      ${listings.searchVector} @@ websearch_to_tsquery('norwegian', ${q})
      OR ${listings.searchVector} @@ websearch_to_tsquery('simple', ${q})
      OR similarity(${listings.title}, ${q}) > 0.3)`);
  }
  const page = Math.min(Math.max(f.page ?? 1, 1), MAX_PAGE);
  const order =
    f.sort === "price"
      ? [sql`${listings.priceOre} ASC NULLS LAST`, desc(listings.publishedAt), desc(listings.id)]
      : [sql`${listings.isDemo} ASC`, desc(listings.publishedAt), desc(listings.id)]; // real listings before examples
  const rows = await db
    .select(summaryColumns)
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .innerJoin(localities, eq(localities.id, listings.localityId))
    .innerJoin(userProfiles, eq(userProfiles.userId, listings.ownerId))
    .where(and(...where))
    .orderBy(...order)
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export async function latestListings(type: ListingType, limit: number): Promise<ListingSummary[]> {
  const showDemo = await isFlagEnabled(db, "show_demo_listings");
  return db
    .select(summaryColumns)
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .innerJoin(localities, eq(localities.id, listings.localityId))
    .innerJoin(userProfiles, eq(userProfiles.userId, listings.ownerId))
    .where(and(...visibleConditions(showDemo), eq(listings.type, type)))
    .orderBy(sql`${listings.isDemo} ASC`, desc(listings.publishedAt))
    .limit(limit);
}

export type CategoryOption = {
  id: string;
  slug: string;
  parentId: string | null;
  labels: LocalizedText;
  icon: string;
  policy: "allowed" | "restricted" | "prohibited";
  safetyNotice: LocalizedText | null;
  allowPaidRental: boolean;
  allowedListingTypes: string[];
};

export async function listCategories(): Promise<CategoryOption[]> {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      parentId: categories.parentId,
      labels: categories.labels,
      icon: categories.icon,
      policy: categories.policy,
      safetyNotice: categories.safetyNotice,
      allowPaidRental: categories.allowPaidRental,
      allowedListingTypes: categories.allowedListingTypes,
    })
    .from(categories)
    .where(and(eq(categories.active, true), ne(categories.policy, "prohibited")))
    .orderBy(asc(categories.sortOrder));
}

export async function listLocalities() {
  return db
    .select({ id: localities.id, slug: localities.slug, name: localities.name })
    .from(localities)
    .where(eq(localities.active, true))
    .orderBy(asc(localities.sortOrder));
}

export type ListingDetail = Awaited<ReturnType<typeof loadDetail>>;

async function loadDetail(id: string) {
  const [row] = await db
    .select({
      listing: listings,
      category: {
        slug: categories.slug,
        labels: categories.labels,
        policy: categories.policy,
        safetyNotice: categories.safetyNotice,
        allowPaidRental: categories.allowPaidRental,
      },
      locality: { name: localities.name, slug: localities.slug },
      owner: { id: users.id, name: users.name, createdAt: users.createdAt, status: userProfiles.status },
    })
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .innerJoin(localities, eq(localities.id, listings.localityId))
    .innerJoin(users, eq(users.id, listings.ownerId))
    .innerJoin(userProfiles, eq(userProfiles.userId, listings.ownerId))
    .where(eq(listings.id, id));
  if (!row) return null;
  const images = await db
    .select({ mediaId: listingImages.mediaId, altText: listingImages.altText })
    .from(listingImages)
    .where(eq(listingImages.listingId, id))
    .orderBy(asc(listingImages.sortOrder));
  return { ...row, images };
}

/**
 * Listing detail with visibility from the policy: published listings for everyone, other
 * statuses only for the owner or staff. Unknown or hidden → null (404, no existence leak).
 */
export async function getListingForViewer(actor: Actor, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const d = await loadDetail(id);
  if (!d || d.listing.status === "deleted") return null;
  const ownerHidden = !["active", "restricted"].includes(d.owner.status);
  const resource = {
    type: "listing" as const,
    ownerId: d.listing.ownerId,
    status: d.listing.status,
    isDemo: d.listing.isDemo,
  };
  const viewable = can(actor, "listing.view", resource).allow;
  const ownerOrStaff = actor.kind === "user" && (actor.id === d.listing.ownerId || can(actor, "admin.access").allow);
  if (!viewable || (ownerHidden && !ownerOrStaff)) return null;
  return d;
}

/** For the edit form: owner only. */
export async function getOwnListing(actor: Actor, id: string) {
  if (actor.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const d = await loadDetail(id);
  if (!d || d.listing.ownerId !== actor.id || d.listing.status === "deleted") return null;
  return d;
}

export async function listOwnListings(actor: Actor) {
  if (actor.kind !== "user") return [];
  return db
    .select({
      id: listings.id,
      type: listings.type,
      title: listings.title,
      status: listings.status,
      updatedAt: listings.updatedAt,
      thumbId: firstImage,
    })
    .from(listings)
    .where(and(eq(listings.ownerId, actor.id), isNull(listings.deletedAt)))
    .orderBy(desc(listings.updatedAt));
}

export async function isSaved(actor: Actor, listingId: string): Promise<boolean> {
  if (actor.kind !== "user") return false;
  const [r] = await db
    .select({ id: savedListings.listingId })
    .from(savedListings)
    .where(and(eq(savedListings.userId, actor.id), eq(savedListings.listingId, listingId)));
  return Boolean(r);
}

export async function listSavedListings(actor: Actor): Promise<ListingSummary[]> {
  if (actor.kind !== "user") return [];
  const showDemo = await isFlagEnabled(db, "show_demo_listings");
  return db
    .select(summaryColumns)
    .from(savedListings)
    .innerJoin(listings, eq(listings.id, savedListings.listingId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .innerJoin(localities, eq(localities.id, listings.localityId))
    .innerJoin(userProfiles, eq(userProfiles.userId, listings.ownerId))
    .where(and(eq(savedListings.userId, actor.id), ...visibleConditions(showDemo)))
    .orderBy(desc(savedListings.createdAt));
}
