import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bookings,
  conversationParticipants,
  conversations,
  giveawayClaims,
  listings,
  messages,
  userBlocks,
  users,
} from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { can } from "@/modules/authz/policy";
import { hasActiveDeal } from "./service";
import { paymentWarning } from "./rules";

export type ThreadMessage = {
  id: string;
  senderId: string | null;
  kind: "user" | "system";
  body: string;
  createdAt: string; // ISO, serialisable to client components
  attachedListing: { id: string; title: string } | null;
  warning: boolean;
};

const UUID = /^[0-9a-f-]{36}$/i;
const THREAD_LIMIT = 300;

/** Inbox: newest activity first. Threads with someone the actor blocked are hidden unless a deal is in progress. */
export async function listInbox(actor: Actor) {
  if (actor.kind !== "user") return [];
  const me = actor.id;
  const rows = await db
    .select({
      id: conversations.id,
      listingId: conversations.listingId,
      listingTitle: listings.title,
      listingType: listings.type,
      initiatorId: conversations.initiatorId,
      ownerId: conversations.listingOwnerId,
      lastMessageAt: conversations.lastMessageAt,
      lastReadAt: conversationParticipants.lastReadAt,
    })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .where(and(eq(conversationParticipants.userId, me), isNull(conversationParticipants.archivedAt)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(200);
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const otherIds = [...new Set(rows.map((r) => (r.initiatorId === me ? r.ownerId : r.initiatorId)))];
  const [names, lastMessages, blocked] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, otherIds)),
    db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        kind: messages.kind,
        body: messages.body,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
    db
      .select({ blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, me), inArray(userBlocks.blockedId, otherIds))),
  ]);
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const lastOf = new Map(lastMessages.map((m) => [m.conversationId, m]));
  const blockedSet = new Set(blocked.map((b) => b.blockedId));

  const out = [];
  for (const r of rows) {
    const otherId = r.initiatorId === me ? r.ownerId : r.initiatorId;
    if (blockedSet.has(otherId) && !(await hasActiveDeal(db, r.id))) continue;
    const last = lastOf.get(r.id);
    out.push({
      id: r.id,
      listingId: r.listingId,
      listingTitle: r.listingTitle,
      otherId,
      otherName: nameOf.get(otherId) ?? null,
      lastMessageAt: r.lastMessageAt,
      last: last ? { kind: last.kind, body: last.body.slice(0, 120), fromMe: last.senderId === me } : null,
      unread: Boolean(last && last.senderId !== me && (!r.lastReadAt || last.createdAt > r.lastReadAt)),
    });
  }
  return out;
}

/** Number of conversations with messages from others that the actor has not read. */
export async function unreadCount(actor: Actor): Promise<number> {
  if (actor.kind !== "user") return 0;
  const [row] = await db
    .select({ n: sql<number>`count(DISTINCT ${conversationParticipants.conversationId})::int` })
    .from(conversationParticipants)
    .innerJoin(
      messages,
      and(
        eq(messages.conversationId, conversationParticipants.conversationId),
        or(isNull(messages.senderId), ne(messages.senderId, actor.id)),
        sql`${messages.createdAt} > coalesce(${conversationParticipants.lastReadAt}, 'epoch'::timestamptz)`,
      ),
    )
    .where(and(eq(conversationParticipants.userId, actor.id), isNull(conversationParticipants.archivedAt)));
  return row?.n ?? 0;
}

async function threadMessages(conversationId: string, after?: Date): Promise<ThreadMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      kind: messages.kind,
      body: messages.body,
      createdAt: messages.createdAt,
      redactedAt: messages.redactedAt,
      attachedId: listings.id,
      attachedTitle: listings.title,
      attachedStatus: listings.status,
    })
    .from(messages)
    .leftJoin(listings, eq(listings.id, messages.attachedListingId))
    .where(and(eq(messages.conversationId, conversationId), ...(after ? [gt(messages.createdAt, after)] : [])))
    .orderBy(desc(messages.createdAt))
    .limit(THREAD_LIMIT);
  return rows.reverse().map((m) => ({
    id: m.id,
    senderId: m.senderId,
    kind: m.kind,
    body: m.redactedAt ? "" : m.body,
    createdAt: m.createdAt.toISOString(),
    attachedListing:
      m.attachedId && m.attachedStatus === "published" ? { id: m.attachedId, title: m.attachedTitle ?? "" } : null,
    warning: m.kind === "user" && !m.redactedAt && paymentWarning(m.body),
  }));
}

/** A thread for one of its two participants; anyone else gets null (404, no existence leak). */
export async function getConversation(actor: Actor, id: string) {
  if (actor.kind !== "user" || !UUID.test(id)) return null;
  const [c] = await db
    .select({
      id: conversations.id,
      listingId: conversations.listingId,
      initiatorId: conversations.initiatorId,
      ownerId: conversations.listingOwnerId,
      listingTitle: listings.title,
      listingType: listings.type,
      listingStatus: listings.status,
    })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .where(eq(conversations.id, id));
  if (
    !c ||
    !can(actor, "conversation.read", { type: "conversation", participantIds: [c.initiatorId, c.ownerId] }).allow
  ) {
    return null;
  }
  const otherId = c.initiatorId === actor.id ? c.ownerId : c.initiatorId;
  const [other] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, otherId));
  const [blocks, threadBookings, threadClaims, msgs, activeDeal] = await Promise.all([
    db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, actor.id), eq(userBlocks.blockedId, otherId)),
          and(eq(userBlocks.blockerId, otherId), eq(userBlocks.blockedId, actor.id)),
        ),
      ),
    db
      .select({ id: bookings.id, status: bookings.status, createdAt: bookings.createdAt })
      .from(bookings)
      .where(eq(bookings.conversationId, id))
      .orderBy(asc(bookings.createdAt)),
    db
      .select({ id: giveawayClaims.id, status: giveawayClaims.status })
      .from(giveawayClaims)
      .where(eq(giveawayClaims.conversationId, id)),
    threadMessages(id),
    hasActiveDeal(db, id),
  ]);
  const blockedByMe = blocks.some((b) => b.blockerId === actor.id);
  const blockedByOther = blocks.some((b) => b.blockerId === otherId);
  return {
    ...c,
    meId: actor.id,
    other: { id: otherId, name: other?.name ?? null },
    isOwner: c.ownerId === actor.id,
    blockedByMe,
    blockedByOther,
    canSend: !(blockedByMe || blockedByOther) || activeDeal,
    bookings: threadBookings,
    claims: threadClaims,
    messages: msgs,
  };
}

/** Messages newer than `afterIso`, for the 20-second polling of an open thread. */
export async function pollConversation(actor: Actor, id: string, afterIso: string): Promise<ThreadMessage[] | null> {
  if (actor.kind !== "user" || !UUID.test(id)) return null;
  const [c] = await db
    .select({ initiatorId: conversations.initiatorId, ownerId: conversations.listingOwnerId })
    .from(conversations)
    .where(eq(conversations.id, id));
  if (
    !c ||
    !can(actor, "conversation.read", { type: "conversation", participantIds: [c.initiatorId, c.ownerId] }).allow
  ) {
    return null;
  }
  const after = new Date(afterIso);
  return threadMessages(id, Number.isNaN(after.getTime()) ? undefined : after);
}

/** For the listing page: the actor's existing conversation about it, if any. */
export async function conversationForListing(actor: Actor, listingId: string): Promise<string | null> {
  if (actor.kind !== "user") return null;
  const [c] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.initiatorId, actor.id)));
  return c?.id ?? null;
}

/** The actor's own published «Leies ut» listings, to attach to a reply to «Ønskes leid» (D-020). */
export async function ownRentalListings(actor: Actor) {
  if (actor.kind !== "user") return [];
  return db
    .select({ id: listings.id, title: listings.title })
    .from(listings)
    .where(
      and(
        eq(listings.ownerId, actor.id),
        eq(listings.type, "rent_out"),
        eq(listings.status, "published"),
        isNull(listings.deletedAt),
      ),
    )
    .orderBy(desc(listings.publishedAt))
    .limit(50);
}
