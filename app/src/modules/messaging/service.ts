import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "@/db/client";
import {
  bookings,
  conversationParticipants,
  conversations,
  giveawayClaims,
  listings,
  messages,
  notifications,
  userBlocks,
  userProfiles,
  users,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { notify } from "@/modules/notifications/notify";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta } from "@/modules/server/request-meta";
import { getOrCreateConversation, isBlockedBetween } from "./conversations";
import { ACTIVE_BOOKING_STATUSES, ACTIVE_CLAIM_STATUSES, MESSAGE_MAX_LENGTH } from "./rules";

/**
 * Conversations and messages (P02-01). Message text is plain text, rendered as React text only,
 * and never written to logs, emails or audit metadata.
 */

export const messageSchema = z.object({
  body: z.string().trim().min(1, { error: "required" }).max(MESSAGE_MAX_LENGTH, { error: "too_long" }),
  conversationId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  listingId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  attachedListingId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type MessageInput = z.infer<typeof messageSchema>;

/** Throws when either user has blocked the other (used before new conversations, requests and claims). */
export async function assertCanContact(conn: DbOrTx, actorId: string, otherId: string): Promise<void> {
  if (await isBlockedBetween(conn, actorId, otherId)) throw new AppError("forbidden", "blocked");
}

/** A booking or giveaway claim in progress keeps the thread open for both, even after a block. */
export async function hasActiveDeal(conn: DbOrTx, conversationId: string): Promise<boolean> {
  const [b] = await conn
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.conversationId, conversationId), inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES])))
    .limit(1);
  if (b) return true;
  const [c] = await conn
    .select({ id: giveawayClaims.id })
    .from(giveawayClaims)
    .where(
      and(
        eq(giveawayClaims.conversationId, conversationId),
        inArray(giveawayClaims.status, [...ACTIVE_CLAIM_STATUSES]),
      ),
    )
    .limit(1);
  return Boolean(c);
}

async function loadConversation(conn: DbOrTx, id: string) {
  const [c] = await conn
    .select({
      id: conversations.id,
      listingId: conversations.listingId,
      initiatorId: conversations.initiatorId,
      ownerId: conversations.listingOwnerId,
      listingTitle: listings.title,
      listingType: listings.type,
    })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .where(eq(conversations.id, id));
  return c ?? null;
}

/** One unread «new message» notice per conversation is enough; more would only bury other notices. */
async function notifyNewMessage(tx: DbOrTx, userId: string, conversationId: string, title: string) {
  const path = `/meldinger/${conversationId}`;
  const [open] = await tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, "new_message"),
        isNull(notifications.readAt),
        sql`${notifications.payload}->>'path' = ${path}`,
      ),
    )
    .limit(1);
  if (!open) await notify(tx, { userId, kind: "new_message", title, path, email: "none" });
}

/** Database errors carry the query parameters and the failing row; keep the message text out of the logs. */
function withoutBody(err: unknown): Error {
  const pgCode = (err as { cause?: { code?: unknown } }).cause?.code ?? (err as { code?: unknown }).code;
  return new Error(`message insert failed${typeof pgCode === "string" ? ` (${pgCode})` : ""}`);
}

async function checkAttachment(conn: DbOrTx, actor: UserActor, listingType: string, attachedListingId?: string) {
  if (!attachedListingId) return null;
  // D-020: a reply to «Ønskes leid» may point to one of the replier's own published «Leies ut» listings.
  if (listingType !== "wanted") throw new AppError("validation", "attachment_invalid");
  const [own] = await conn
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(
        eq(listings.id, attachedListingId),
        eq(listings.ownerId, actor.id),
        eq(listings.type, "rent_out"),
        eq(listings.status, "published"),
        isNull(listings.deletedAt),
      ),
    );
  if (!own) throw new AppError("validation", "attachment_invalid");
  return own.id;
}

/**
 * Send a message in an existing conversation, or start one about a listing (one conversation per
 * listing and interested user). Returns the conversation and message ids.
 */
export async function sendMessage(
  actor: Actor,
  input: MessageInput,
): Promise<{ conversationId: string; messageId: string }> {
  const body = input.body.trim();
  if (!body) throw new AppError("validation", "required");
  let conversationId = input.conversationId;
  let otherId: string;
  let listingTitle: string;
  let listingType: string;

  if (conversationId) {
    const c = await loadConversation(db, conversationId);
    if (!c) throw new AppError("not_found");
    assertCan(actor, "message.send", { type: "conversation", participantIds: [c.initiatorId, c.ownerId] });
    otherId = c.initiatorId === actor.id ? c.ownerId : c.initiatorId;
    if ((await isBlockedBetween(db, actor.id, otherId)) && !(await hasActiveDeal(db, c.id))) {
      throw new AppError("forbidden", "blocked");
    }
    listingTitle = c.listingTitle;
    listingType = c.listingType;
  } else {
    if (!input.listingId) throw new AppError("validation", "required");
    assertCan(actor, "conversation.start");
    const [l] = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
        title: listings.title,
        type: listings.type,
        status: listings.status,
        isDemo: listings.isDemo,
        deletedAt: listings.deletedAt,
        ownerStatus: userProfiles.status,
      })
      .from(listings)
      .innerJoin(userProfiles, eq(userProfiles.userId, listings.ownerId))
      .where(eq(listings.id, input.listingId));
    if (!l || l.deletedAt || l.status !== "published" || !["active", "restricted"].includes(l.ownerStatus)) {
      throw new AppError("not_found");
    }
    if (l.isDemo) throw new AppError("forbidden", "listing_unavailable");
    if (l.ownerId === actor.id) throw new AppError("forbidden", "own_listing");
    await assertCanContact(db, actor.id, l.ownerId);
    otherId = l.ownerId;
    listingTitle = l.title;
    listingType = l.type;
  }

  const user = actor as UserActor;
  const attachedListingId = await checkAttachment(db, user, listingType, input.attachedListingId);
  await enforceRateLimits(db, [
    { bucket: `message:user:${user.id}`, rule: user.isNewAccount ? LIMITS.messagesNew : LIMITS.messagesEstablished },
  ]);

  return db.transaction(async (tx) => {
    if (!conversationId) {
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.listingId, input.listingId!), eq(conversations.initiatorId, user.id)));
      if (!existing) {
        await enforceRateLimits(tx, [
          {
            bucket: `conversation:user:${user.id}`,
            rule: user.isNewAccount ? LIMITS.conversationsNew : LIMITS.conversationsEstablished,
          },
        ]);
      }
      conversationId = await getOrCreateConversation(tx, {
        listingId: input.listingId!,
        ownerId: otherId,
        initiatorId: user.id,
      });
    }
    const now = new Date();
    const [m] = await tx
      .insert(messages)
      .values({ conversationId, senderId: user.id, kind: "user", body, attachedListingId })
      .returning({ id: messages.id })
      .catch((err: unknown) => {
        throw withoutBody(err);
      });
    await tx.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
    // The sender has read everything up to their own message; the thread reappears for both if archived.
    await tx
      .update(conversationParticipants)
      .set({ lastReadAt: now, archivedAt: null })
      .where(
        and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, user.id)),
      );
    await tx
      .update(conversationParticipants)
      .set({ archivedAt: null })
      .where(
        and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, otherId)),
      );
    await notifyNewMessage(tx, otherId, conversationId, listingTitle);
    return { conversationId, messageId: m!.id };
  });
}

/** Mark everything in a thread as read for the actor (and their «new message» notice). */
export async function markRead(actor: Actor, conversationId: string): Promise<void> {
  if (actor.kind !== "user") return;
  const now = new Date();
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: now })
    .where(
      and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, actor.id)),
    );
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, actor.id),
        eq(notifications.type, "new_message"),
        isNull(notifications.readAt),
        sql`${notifications.payload}->>'path' = ${`/meldinger/${conversationId}`}`,
      ),
    );
}

const blockSchema = z.object({ userId: z.uuid() });

/**
 * «Blokker»: neither can start conversations, send messages, requests or claims to the other.
 * Threads with a booking or claim in progress stay usable so both can finish it.
 */
export async function blockUser(actor: Actor, input: z.infer<typeof blockSchema>): Promise<void> {
  assertCan(actor, "user.block");
  const { userId } = blockSchema.parse(input);
  if (userId === actor.id) throw new AppError("validation");
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("not_found");
  await db.insert(userBlocks).values({ blockerId: actor.id, blockedId: userId }).onConflictDoNothing();
  await recordAudit(db, {
    actorId: actor.id,
    action: "user.block",
    targetType: "user",
    targetId: userId,
    meta: await getRequestMeta(),
  });
}

export async function unblockUser(actor: Actor, input: z.infer<typeof blockSchema>): Promise<void> {
  assertCan(actor, "user.block");
  const { userId } = blockSchema.parse(input);
  await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, actor.id), eq(userBlocks.blockedId, userId)));
  await recordAudit(db, {
    actorId: actor.id,
    action: "user.unblock",
    targetType: "user",
    targetId: userId,
    meta: await getRequestMeta(),
  });
}
