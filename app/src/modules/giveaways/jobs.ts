import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { giveawayClaims, listings } from "@/db/schema";
import { postSystemMessage } from "@/modules/messaging/conversations";
import { notify } from "@/modules/notifications/notify";
import { CLAIM_EXPIRY_DAYS } from "./service";

/** `giveaway_claim_expiry`: claims the giver has not answered within 14 days expire (DATA_MODEL §6). */
export async function expireClaims(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CLAIM_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const due = await db
    .select({ id: giveawayClaims.id })
    .from(giveawayClaims)
    .where(and(eq(giveawayClaims.status, "requested"), lt(giveawayClaims.createdAt, cutoff)))
    .limit(200);
  let done = 0;
  for (const { id } of due) {
    const moved = await db.transaction(async (tx) => {
      const [g] = await tx
        .update(giveawayClaims)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(eq(giveawayClaims.id, id), eq(giveawayClaims.status, "requested"), lt(giveawayClaims.createdAt, cutoff)),
        )
        .returning();
      if (!g) return false;
      const [l] = await tx.select({ title: listings.title }).from(listings).where(eq(listings.id, g.listingId));
      await postSystemMessage(tx, g.conversationId, "claim.expired");
      await notify(tx, {
        userId: g.claimantId,
        kind: "claim_expired",
        title: l?.title ?? "",
        path: `/annonse/${g.listingId}`,
        email: "optional",
      });
      return true;
    });
    if (moved) done++;
  }
  return done;
}
