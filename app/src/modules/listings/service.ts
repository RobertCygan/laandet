import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import {
  categories,
  listingImages,
  listings,
  localities,
  mediaObjects,
  reports,
  savedListings,
  screeningKeywords,
  type ListingStatus,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { isFlagEnabled } from "@/modules/flags/flags";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta } from "@/modules/server/request-meta";
import { containsContactInfo, matchScreeningKeywords, MAX_IMAGES, publishViolations, storageViolations, type ListingDraft } from "./rules";

export type SaveIntent = "draft" | "publish";
export type ImageInput = { mediaId: string; altText: string | null };
export type SaveResult = { id: string; status: ListingStatus; warnings: string[] };

async function loadOwned(actor: Actor, listingId: string, action: "listing.update" | "listing.publish" | "listing.delete") {
  const [row] = await db.select().from(listings).where(eq(listings.id, listingId));
  if (!row) throw new AppError("not_found");
  assertCan(actor, action, { type: "listing", ownerId: row.ownerId, status: row.status, isDemo: row.isDemo });
  return row;
}

function violationsError(v: { field: string; code: string }[]): AppError {
  const fieldErrors: Record<string, string> = {};
  for (const x of v) fieldErrors[x.field] ??= x.code;
  return new AppError("validation", "listing_invalid", { fieldErrors });
}

async function syncImages(tx: Tx, actor: UserActor, listingId: string, images: ImageInput[]) {
  if (images.length > MAX_IMAGES) throw violationsError([{ field: "images", code: "too_many_images" }]);
  const ids = images.map((i) => i.mediaId);
  if (ids.length) {
    // Only the actor's own, unattached (or already on this listing) listing uploads may be used.
    const owned = await tx
      .select({ id: mediaObjects.id })
      .from(mediaObjects)
      .leftJoin(listingImages, eq(listingImages.mediaId, mediaObjects.id))
      .where(
        and(
          inArray(mediaObjects.id, ids),
          eq(mediaObjects.uploadedBy, actor.id),
          eq(mediaObjects.scope, "listing"),
          isNull(mediaObjects.deletedAt),
          sql`(${listingImages.listingId} IS NULL OR ${listingImages.listingId} = ${listingId})`,
        ),
      );
    if (owned.length !== new Set(ids).size) throw new AppError("not_found", "media");
  }
  const previous = await tx.select({ mediaId: listingImages.mediaId }).from(listingImages).where(eq(listingImages.listingId, listingId));
  await tx.delete(listingImages).where(eq(listingImages.listingId, listingId));
  for (const [i, img] of images.entries()) {
    await tx.insert(listingImages).values({ listingId, mediaId: img.mediaId, sortOrder: i, altText: img.altText?.slice(0, 150) ?? null });
  }
  const removed = previous.map((p) => p.mediaId).filter((id) => !ids.includes(id));
  if (removed.length) {
    await tx.update(mediaObjects).set({ deletedAt: new Date() }).where(inArray(mediaObjects.id, removed));
  }
}

/**
 * Create or update a listing (P01-08). Drafts may be incomplete; publishing (or saving an
 * already published listing) applies every rule in rules.ts on the server.
 */
export async function saveListing(
  actor: Actor,
  draft: ListingDraft,
  images: ImageInput[],
  opts: { listingId?: string; intent: SaveIntent },
): Promise<SaveResult> {
  const existing = opts.listingId ? await loadOwned(actor, opts.listingId, "listing.update") : null;
  if (!existing) {
    assertCan(actor, "listing.create");
    if (!(await isFlagEnabled(db, "listings_open"))) throw new AppError("feature_disabled");
  }
  const user = actor as UserActor;
  if (existing && existing.type !== draft.type) throw violationsError([{ field: "type", code: "type_locked" }]);

  const [category] = await db.select().from(categories).where(eq(categories.id, draft.categoryId));
  const [locality] = await db.select().from(localities).where(eq(localities.id, draft.localityId));
  if (!category) throw violationsError([{ field: "categoryId", code: "category_not_allowed" }]);
  if (!locality || !locality.active) throw violationsError([{ field: "localityId", code: "required" }]);
  if (category.policy === "prohibited") throw violationsError([{ field: "categoryId", code: "category_not_allowed" }]);

  const stored = storageViolations(draft);
  if (stored.length) throw violationsError(stored);
  const live = existing && (existing.status === "published" || existing.status === "paused");
  const publishing = opts.intent === "publish" || Boolean(live);
  if (publishing) {
    const v = publishViolations({ ...draft, imageCount: images.length }, category, {
      highValuePreview: await isFlagEnabled(db, "high_value_preview"),
    });
    if (v.length) throw violationsError(v);
  }
  const firstPublish = opts.intent === "publish" && !existing?.publishedAt;
  if (firstPublish) {
    await enforceRateLimits(db, [
      { bucket: `publish:user:${user.id}`, rule: user.isNewAccount ? LIMITS.publishNew : LIMITS.publishEstablished },
    ]);
  }

  const status: ListingStatus = existing ? (opts.intent === "publish" && existing.status === "draft" ? "published" : existing.status) : opts.intent === "publish" ? "published" : "draft";
  const now = new Date();
  const values = {
    type: draft.type,
    title: draft.title,
    description: draft.description,
    categoryId: draft.categoryId,
    localityId: draft.localityId,
    areaNote: draft.areaNote,
    itemCondition: draft.itemCondition,
    knownDefects: draft.knownDefects,
    priceOre: draft.priceOre,
    priceUnit: draft.priceUnit,
    declaredValueOre: draft.declaredValueOre,
    depositOre: draft.depositOre,
    usageRestrictions: draft.usageRestrictions,
    includedAccessories: draft.includedAccessories,
    operatingInstructions: draft.operatingInstructions,
    restrictedAckAt: category.policy === "restricted" && draft.restrictedAck ? (existing?.restrictedAckAt ?? now) : null,
    wantedFrom: draft.wantedFrom,
    wantedTo: draft.wantedTo,
    budgetOre: draft.budgetOre,
    handoverPickup: draft.handoverPickup,
    handoverOwnerDelivery: draft.handoverOwnerDelivery,
    deliveryFeeOre: draft.deliveryFeeOre,
    deliveryRadiusKm: draft.deliveryRadiusKm,
    handoverMeet: draft.handoverMeet,
    meetingAreaNote: draft.meetingAreaNote,
    status,
    publishedAt: existing?.publishedAt ?? (status === "published" ? now : null),
    updatedAt: now,
  };
  const meta = await getRequestMeta();

  const id = await db.transaction(async (tx) => {
    let listingId: string;
    if (existing) {
      await tx.update(listings).set(values).where(eq(listings.id, existing.id));
      listingId = existing.id;
    } else {
      const [row] = await tx.insert(listings).values({ ...values, ownerId: user.id }).returning({ id: listings.id });
      listingId = row!.id;
    }
    await syncImages(tx, user, listingId, images);
    await recordAudit(tx, {
      actorId: user.id,
      actorRole: user.role,
      action: existing ? (firstPublish ? "listing.publish" : "listing.update") : status === "published" ? "listing.publish" : "listing.create",
      targetType: "listing",
      targetId: listingId,
      meta,
    });
    if (status === "published") await screenListing(tx, listingId, `${draft.title} ${draft.description}`);
    return listingId;
  });

  const warnings: string[] = [];
  if (containsContactInfo(draft.description)) warnings.push("description_contact_info");
  return { id, status, warnings };
}

/** Keyword hints create an automatic report for moderators; nothing is removed automatically. */
async function screenListing(tx: Tx, listingId: string, text: string) {
  const keywords = (await tx.select({ k: screeningKeywords.keyword }).from(screeningKeywords)).map((r) => r.k);
  const hits = matchScreeningKeywords(text, keywords);
  if (!hits.length) return;
  const [open] = await tx
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.targetType, "listing"), eq(reports.targetId, listingId), eq(reports.isAutomatic, true), eq(reports.status, "open")));
  if (open) return;
  await tx.insert(reports).values({
    reporterId: null,
    isAutomatic: true,
    targetType: "listing",
    targetId: listingId,
    reason: "prohibited_item",
    details: `Automatisk: nøkkelord ${hits.slice(0, 5).join(", ")}`,
  });
}

export type StatusAction = "pause" | "resume" | "archive" | "delete";

const TRANSITIONS: Record<StatusAction, { from: ListingStatus[]; to: ListingStatus }> = {
  pause: { from: ["published"], to: "paused" },
  resume: { from: ["paused"], to: "published" },
  archive: { from: ["draft", "published", "paused"], to: "archived" },
  delete: { from: ["draft", "published", "paused", "archived", "removed"], to: "deleted" },
};

export async function changeListingStatus(actor: Actor, listingId: string, action: StatusAction): Promise<void> {
  const row = await loadOwned(actor, listingId, action === "delete" ? "listing.delete" : "listing.update");
  const t = TRANSITIONS[action];
  if (!t.from.includes(row.status)) throw new AppError("conflict", "status_transition");
  // Phase 02: refuse while a booking or giveaway claim is active.
  await db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({ status: t.to, updatedAt: new Date(), ...(action === "delete" ? { deletedAt: new Date() } : {}) })
      .where(eq(listings.id, row.id));
    await recordAudit(tx, {
      actorId: (actor as UserActor).id,
      action: `listing.${action}`,
      targetType: "listing",
      targetId: row.id,
      meta: await getRequestMeta(),
    });
  });
}

export async function toggleSavedListing(actor: Actor, listingId: string): Promise<boolean> {
  assertCan(actor, "savedListing.toggle");
  const [l] = await db.select({ id: listings.id }).from(listings).where(and(eq(listings.id, listingId), eq(listings.status, "published")));
  if (!l) throw new AppError("not_found");
  const removed = await db
    .delete(savedListings)
    .where(and(eq(savedListings.userId, actor.id), eq(savedListings.listingId, listingId)))
    .returning();
  if (removed.length) return false;
  await db.insert(savedListings).values({ userId: actor.id, listingId }).onConflictDoNothing();
  return true;
}
