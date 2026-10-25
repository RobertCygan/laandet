import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, disputeEvents, disputeProposals, disputes, listings, messages, users } from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { can } from "@/modules/authz/policy";
import { canEscalate, decodeRecommendation, isOpen, MAX_CASE_EVENTS, OPEN_DISPUTE_STATUSES } from "./rules";

/**
 * Read models for the parties' case page (P03-01). Staff-only notes are returned without their text,
 * so the page can show «intern merknad» and nothing more.
 */
export async function getDisputeForParty(actor: Actor, disputeId: string, now = new Date()) {
  if (actor.kind !== "user" || !/^[0-9a-f-]{36}$/i.test(disputeId)) return null;
  const [row] = await db
    .select({ d: disputes, title: listings.title, conversationId: bookings.conversationId })
    .from(disputes)
    .innerJoin(bookings, eq(bookings.id, disputes.bookingId))
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(eq(disputes.id, disputeId));
  if (!row) return null;
  const d = row.d;
  if (!can(actor, "dispute.view", { type: "dispute", openerId: d.openedBy, respondentId: d.respondentId }).allow)
    return null;
  const [events, proposals, people, thread] = await Promise.all([
    db
      .select()
      .from(disputeEvents)
      .where(eq(disputeEvents.disputeId, d.id))
      .orderBy(asc(disputeEvents.createdAt))
      .limit(MAX_CASE_EVENTS + 100),
    db
      .select()
      .from(disputeProposals)
      .where(eq(disputeProposals.disputeId, d.id))
      .orderBy(asc(disputeProposals.createdAt))
      .limit(MAX_CASE_EVENTS),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [d.openedBy, d.respondentId])),
    db
      .select({ id: messages.id, senderId: messages.senderId, body: messages.body, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.conversationId, row.conversationId), eq(messages.kind, "user")))
      .orderBy(desc(messages.createdAt))
      .limit(50),
  ]);
  const visible = events.map((e) =>
    e.visibility === "staff_only" ? { ...e, body: null, mediaId: null, reference: null } : e,
  );
  const referencedIds = new Set(visible.flatMap((e) => (e.reference?.type === "message" ? [e.reference.id] : [])));
  const recommendations = visible.filter((e) => e.kind === "support_recommendation");
  const latest = recommendations.at(-1) ?? null;
  const answersTo = (eventId: string) =>
    visible.filter(
      (e) => e.kind === "proposal_response" && e.reference?.type === "recommendation" && e.reference.id === eventId,
    );
  const lastAnswer = (eventId: string, userId: string) =>
    answersTo(eventId)
      .filter((a) => a.actorId === userId)
      .at(-1)?.body ?? null;
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? null;
  return {
    dispute: d,
    title: row.title,
    meId: actor.id,
    isOpener: d.openedBy === actor.id,
    otherId: d.openedBy === actor.id ? d.respondentId : d.openedBy,
    openerName: name(d.openedBy) ?? "",
    respondentName: name(d.respondentId) ?? "",
    nameOf: Object.fromEntries(people.map((p) => [p.id, p.name])) as Record<string, string>,
    events: visible,
    proposals,
    pendingProposal: proposals.find((p) => p.status === "pending") ?? null,
    latestRecommendation: latest
      ? {
          id: latest.id,
          text: decodeRecommendation(latest.body),
          mine: lastAnswer(latest.id, actor.id),
          other: lastAnswer(latest.id, d.openedBy === actor.id ? d.respondentId : d.openedBy),
        }
      : null,
    thread: thread.filter((m) => !referencedIds.has(m.id)),
    referenced: thread.filter((m) => referencedIds.has(m.id)),
    open: isOpen(d.status),
    canEscalate: canEscalate(d, now),
  };
}

export type DisputeView = NonNullable<Awaited<ReturnType<typeof getDisputeForParty>>>;

/** The viewer's cases, for «Mine leieforhold». */
export async function listMyDisputes(actor: Actor) {
  if (actor.kind !== "user") return [];
  return db
    .select({
      id: disputes.id,
      status: disputes.status,
      category: disputes.category,
      openedAt: disputes.openedAt,
      title: listings.title,
      isOpener: eq(disputes.openedBy, actor.id),
    })
    .from(disputes)
    .innerJoin(bookings, eq(bookings.id, disputes.bookingId))
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(or(eq(disputes.openedBy, actor.id), eq(disputes.respondentId, actor.id)))
    .orderBy(desc(disputes.openedAt))
    .limit(100);
}

/** The open case on a booking, if any (the booking page links to it instead of offering a new one). */
export async function openDisputeIdForBooking(bookingId: string): Promise<string | null> {
  const [d] = await db
    .select({ id: disputes.id })
    .from(disputes)
    .where(and(eq(disputes.bookingId, bookingId), inArray(disputes.status, [...OPEN_DISPUTE_STATUSES])));
  return d?.id ?? null;
}
