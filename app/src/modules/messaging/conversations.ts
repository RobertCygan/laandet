import { and, eq, or } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { conversationParticipants, conversations, messages, userBlocks } from "@/db/schema";

/**
 * Shared core of P02-01, used by rental requests and giveaway claims too: one conversation per
 * (listing, interested user). Message text is never logged.
 */
export async function getOrCreateConversation(
  db: DbOrTx,
  input: { listingId: string; ownerId: string; initiatorId: string },
): Promise<string> {
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.listingId, input.listingId), eq(conversations.initiatorId, input.initiatorId)));
  if (existing) return existing.id;
  const [created] = await db
    .insert(conversations)
    .values({ listingId: input.listingId, initiatorId: input.initiatorId, listingOwnerId: input.ownerId })
    .onConflictDoNothing()
    .returning({ id: conversations.id });
  const id =
    created?.id ??
    (
      await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.listingId, input.listingId), eq(conversations.initiatorId, input.initiatorId)))
    )[0]!.id;
  await db
    .insert(conversationParticipants)
    .values([
      { conversationId: id, userId: input.initiatorId },
      { conversationId: id, userId: input.ownerId },
    ])
    .onConflictDoNothing();
  return id;
}

/**
 * System messages store a stable key (e.g. `booking.requested`) and are rendered in each reader's
 * language (`messages.system.<key>` in nb.json / en.json).
 */
export async function postSystemMessage(db: DbOrTx, conversationId: string, key: string): Promise<void> {
  await db.insert(messages).values({ conversationId, senderId: null, kind: "system", body: key });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
}

/** True if either user has blocked the other (AUTH_MODEL §4 notes). */
export async function isBlockedBetween(db: DbOrTx, a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ blocker: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}
