import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { listingImages, listings, mediaObjects, userProfiles } from "@/db/schema";
import { getActor } from "@/modules/auth/actor";
import { can } from "@/modules/authz/policy";
import { mayViewConditionMedia } from "@/modules/condition/service";
import { mediaStore } from "@/modules/media/store";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Authorised image delivery (SEC-33). Published listing images are public; drafts only for
 * the owner (or the uploader before attaching); condition photos only for the booking parties.
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
    // Condition photos (P02-05): only the two booking parties (N13).
    if (!(await mayViewConditionMedia(await getActor(), id, m.uploadedBy))) return notFound();
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
