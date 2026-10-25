import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { listingImages, listings, mediaObjects } from "@/db/schema";
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
    })
    .from(mediaObjects)
    .leftJoin(listingImages, eq(listingImages.mediaId, mediaObjects.id))
    .leftJoin(listings, eq(listings.id, listingImages.listingId))
    .where(and(eq(mediaObjects.id, id), isNull(mediaObjects.deletedAt)));
  if (!m || m.scope !== "listing") return notFound();

  let isPublic = false;
  if (m.listingStatus === "published") {
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
  const data = await mediaStore().get(variant === "thumb" ? m.thumbKey : m.storageKey);
  if (!data) return notFound();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublic ? "public, max-age=86400" : "private, no-store",
    },
  });
}
