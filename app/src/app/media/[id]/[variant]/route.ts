import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bookings,
  conditionEntries,
  conditionPhotos,
  conditionReports,
  listingImages,
  listings,
  mediaObjects,
  userProfiles,
} from "@/db/schema";
import { getActor } from "@/modules/auth/actor";
import { can } from "@/modules/authz/policy";
import { mediaStore } from "@/modules/media/store";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Authorised image delivery (SEC-33). Published listing images are public; drafts only for
 * the owner (or the uploader before attaching); condition/dispute media arrive in Phase 02/03.
 */
export async function GET(_req: Request, ctx: RouteContext<"/media/[id]/[variant]">) {
  const { id, variant } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || (variant !== "display" && variant !== "thumb")) return notFound();
  const [m] = await db
    .select({
      storageKey: mediaObjects.storageKey,
      thumbKey: mediaObjects.thumbKey,
      scope: mediaObjects.scope,
      uploadedBy: mediaObjects.uploadedBy,
      listingStatus: listings.status,
      ownerId: listings.ownerId,
      isDemo: listings.isDemo,
      ownerStatus: userProfiles.status,
    })
    .from(mediaObjects)
    .leftJoin(listingImages, eq(listingImages.mediaId, mediaObjects.id))
    .leftJoin(listings, eq(listings.id, listingImages.listingId))
    .leftJoin(userProfiles, eq(userProfiles.userId, listings.ownerId))
    .where(and(eq(mediaObjects.id, id), isNull(mediaObjects.deletedAt)));
  if (!m || (m.scope !== "listing" && m.scope !== "condition")) return notFound();

  let isPublic = false;
  if (m.scope === "condition") {
    // Condition photos (P02-05): only the two booking parties; before attaching, only the uploader.
    // Staff access needs an audited dispute grant (Phase 03), so staff get 404 here too (N13).
    const actor = await getActor();
    if (actor.kind !== "user") return notFound();
    const [party] = await db
      .select({ ownerId: bookings.ownerId, renterId: bookings.renterId })
      .from(conditionPhotos)
      .innerJoin(conditionEntries, eq(conditionEntries.id, conditionPhotos.entryId))
      .innerJoin(conditionReports, eq(conditionReports.id, conditionEntries.reportId))
      .innerJoin(bookings, eq(bookings.id, conditionReports.bookingId))
      .where(eq(conditionPhotos.mediaId, id));
    const allowed = party ? actor.id === party.ownerId || actor.id === party.renterId : actor.id === m.uploadedBy;
    if (!allowed) return notFound();
    return serve(m, variant, false);
  }
  // Same visibility as the listing page: published, and the owner's account in good standing.
  if (m.listingStatus === "published" && (m.ownerStatus === "active" || m.ownerStatus === "restricted")) {
    isPublic = true;
  } else {
    const actor = await getActor();
    const allowed = m.ownerId
      ? can(actor, "listing.view", {
          type: "listing",
          ownerId: m.ownerId,
          status: m.listingStatus!,
          isDemo: m.isDemo ?? false,
        }).allow
      : actor.kind === "user" && actor.id === m.uploadedBy;
    if (!allowed) return notFound();
  }
  return serve(m, variant, isPublic);
}

async function serve(
  m: { storageKey: string; thumbKey: string },
  variant: string,
  isPublic: boolean,
): Promise<Response> {
  const data = await mediaStore().get(variant === "thumb" ? m.thumbKey : m.storageKey);
  if (!data) return notFound();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // Short cache so a hidden listing's images stop being served within minutes.
      "Cache-Control": isPublic ? "public, max-age=300" : "private, no-store",
    },
  });
}
