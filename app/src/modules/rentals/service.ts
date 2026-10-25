import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import {
  bookingEvents,
  bookings,
  categories,
  contracts,
  HANDOVER_METHODS,
  listings,
  messages,
  userProfiles,
  type BookingStatus,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import {
  closeLiveContract,
  createRentalContract,
  markContractAccepted,
  recordAcceptance,
} from "@/modules/contracts/service";
import { AppError } from "@/modules/errors";
import { isFlagEnabled } from "@/modules/flags/flags";
import { classifyValue } from "@/modules/listings/rules";
import { getOrCreateConversation, isBlockedBetween, postSystemMessage } from "@/modules/messaging/conversations";
import { notify } from "@/modules/notifications/notify";
import type { ActivityKind } from "@/modules/notifications/email-templates";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta } from "@/modules/server/request-meta";
import { periodError, toRange, totalOre, units } from "./pricing";
import { transition, type BookingEvent, type BookingRole } from "./state";

const HOUR = 60 * 60 * 1000;
export const OWNER_RESPONSE_HOURS = 72;
export const AGREEMENT_HOURS = 48;

type BookingRow = typeof bookings.$inferSelect;

const roleOf = (b: BookingRow, userId: string): "owner" | "renter" | null =>
  b.ownerId === userId ? "owner" : b.renterId === userId ? "renter" : null;

/** Loads a booking the actor takes part in (404 otherwise, AUTH_MODEL §5). */
export async function loadBookingFor(
  actor: Actor,
  bookingId: string,
  action: "booking.view" | "booking.participate" | "booking.respond",
  tx: typeof db | Tx = db,
) {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) throw new AppError("not_found");
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!b) throw new AppError("not_found");
  assertCan(actor, action, { type: "booking", ownerId: b.ownerId, renterId: b.renterId });
  return b;
}

export async function periodOf(tx: typeof db | Tx, bookingId: string): Promise<{ start: Date; end: Date }> {
  const r = (
    await tx.execute<{ s: Date; e: Date }>(
      sql`SELECT lower(period) AS s, upper(period) AS e FROM bookings WHERE id = ${bookingId}`,
    )
  ).rows[0]!;
  return { start: new Date(r.s), end: new Date(r.e) };
}

/**
 * Moves a booking through the state machine: checks the transition, updates only if the status is
 * still what we read (so a worker and a user never both act), and writes the booking event.
 */
export async function moveBooking(
  tx: Tx,
  b: BookingRow,
  event: BookingEvent,
  role: BookingRole,
  actorId: string | null,
  set: Partial<typeof bookings.$inferInsert> = {},
  metadata: Record<string, unknown> = {},
): Promise<BookingStatus> {
  const t = transition(b.status, event, role);
  if (!t.ok) throw new AppError(t.error === "wrong_party" ? "forbidden" : "conflict", "booking_transition");
  const updated = await tx
    .update(bookings)
    .set({ ...set, status: t.to, updatedAt: new Date() })
    .where(and(eq(bookings.id, b.id), eq(bookings.status, b.status)))
    .returning({ id: bookings.id });
  if (!updated.length) throw new AppError("conflict", "booking_changed");
  await tx
    .insert(bookingEvents)
    .values({ bookingId: b.id, actorId, event, fromStatus: b.status, toStatus: t.to, metadata });
  return t.to;
}

/** System message in the thread + notice to the other party (or both). */
export async function announce(
  tx: Tx,
  b: BookingRow,
  key: string,
  kind: ActivityKind,
  to: ("owner" | "renter")[],
  title: string,
) {
  await postSystemMessage(tx, b.conversationId, key);
  for (const who of to) {
    await notify(tx, {
      userId: who === "owner" ? b.ownerId : b.renterId,
      kind,
      title,
      path: `/leieforhold/${b.id}`,
      email: "essential",
    });
  }
}

async function listingTitle(tx: typeof db | Tx, listingId: string) {
  const [l] = await tx.select({ title: listings.title }).from(listings).where(eq(listings.id, listingId));
  return l?.title ?? "";
}

// ---------------------------------------------------------------- request

export const requestSchema = z.object({
  listingId: z.uuid(),
  start: z.iso.datetime({ offset: true, error: "date_invalid" }),
  end: z.iso.datetime({ offset: true, error: "date_invalid" }),
  handoverMethod: z.enum(HANDOVER_METHODS, { error: "required" }),
  returnMethod: z.enum(HANDOVER_METHODS, { error: "required" }),
  message: z.string().trim().max(2000, { error: "too_long" }).optional().default(""),
});

/** «Send forespørsel» (P02-02). A request is a booking in status `requested` (D-013). */
export async function requestBooking(
  actor: Actor,
  input: z.infer<typeof requestSchema>,
  now = new Date(),
): Promise<{ id: string }> {
  assertCan(actor, "booking.request");
  if (!(await isFlagEnabled(db, "rentals_open"))) throw new AppError("feature_disabled", "rentals_closed");
  const [l] = await db.select().from(listings).where(eq(listings.id, input.listingId));
  if (!l || l.status !== "published" || l.deletedAt || l.type !== "rent_out") throw new AppError("not_found");
  if (l.isDemo) throw new AppError("forbidden", "demo_listing");
  if (l.ownerId === actor.id) throw new AppError("forbidden", "own_listing");
  const [cat] = await db.select().from(categories).where(eq(categories.id, l.categoryId));
  const [owner] = await db
    .select({ status: userProfiles.status })
    .from(userProfiles)
    .where(eq(userProfiles.userId, l.ownerId));
  if (!owner || owner.status !== "active") throw new AppError("not_found");
  if (await isBlockedBetween(db, actor.id, l.ownerId)) throw new AppError("forbidden", "blocked");

  // Category A only in the MVP (D-011); free lending only where paid rental is paused (D-028).
  if (l.declaredValueOre === null || l.priceOre === null || l.priceUnit === null)
    throw new AppError("conflict", "listing_incomplete");
  if (classifyValue(l.declaredValueOre) !== "A") throw new AppError("forbidden", "high_value_blocked");
  if (!cat?.allowPaidRental && l.priceOre > 0) throw new AppError("forbidden", "paid_rental_not_allowed");

  const allowed = { pickup: l.handoverPickup, owner_delivery: l.handoverOwnerDelivery, meet: l.handoverMeet };
  const fieldErrors: Record<string, string> = {};
  if (!allowed[input.handoverMethod]) fieldErrors.handoverMethod = "method_not_offered";
  if (!allowed[input.returnMethod]) fieldErrors.returnMethod = "method_not_offered";
  const start = new Date(input.start);
  const end = new Date(input.end);
  const perr = periodError(start, end, l.priceUnit, now);
  if (perr) fieldErrors.start = perr;
  if (Object.keys(fieldErrors).length) throw new AppError("validation", "request_invalid", { fieldErrors });

  await enforceRateLimits(db, [
    { bucket: `request:user:${actor.id}`, rule: actor.isNewAccount ? LIMITS.requestsNew : LIMITS.requestsEstablished },
  ]);

  const n = units(start, end, l.priceUnit);
  const meta = await getRequestMeta();
  return db.transaction(async (tx) => {
    const conversationId = await getOrCreateConversation(tx, {
      listingId: l.id,
      ownerId: l.ownerId,
      initiatorId: actor.id,
    });
    const [b] = await tx
      .insert(bookings)
      .values({
        listingId: l.id,
        conversationId,
        ownerId: l.ownerId,
        renterId: actor.id,
        period: toRange(start, end),
        valueCategory: "A",
        declaredValueOre: l.declaredValueOre!,
        priceOre: l.priceOre!,
        priceUnit: l.priceUnit!,
        units: n,
        totalPriceOre: totalOre(l.priceOre!, n),
        depositOre: l.depositOre ?? 0,
        handoverMethod: input.handoverMethod,
        returnMethod: input.returnMethod,
        deliveryFeeOre: input.handoverMethod === "owner_delivery" ? l.deliveryFeeOre : null,
        ownerResponseDueAt: new Date(now.getTime() + OWNER_RESPONSE_HOURS * HOUR),
      })
      .returning();
    await tx
      .insert(bookingEvents)
      .values({ bookingId: b!.id, actorId: actor.id, event: "request", fromStatus: null, toStatus: "requested" });
    if (input.message)
      await tx.insert(messages).values({ conversationId, senderId: actor.id, kind: "user", body: input.message });
    await announce(tx, b!, "booking.requested", "booking_requested", ["owner"], l.title);
    await recordAudit(tx, {
      actorId: actor.id,
      action: "booking.request",
      targetType: "booking",
      targetId: b!.id,
      meta,
    });
    return { id: b!.id };
  });
}

// ---------------------------------------------------------------- owner decision, withdraw, cancel

export async function acceptBooking(actor: Actor, bookingId: string, now = new Date()): Promise<void> {
  const b = await loadBookingFor(actor, bookingId, "booking.respond");
  if (b.status !== "requested") throw new AppError("conflict", "booking_changed");
  if (b.ownerResponseDueAt < now) throw new AppError("conflict", "request_expired");
  const { start } = await periodOf(db, b.id);
  const agreementDueAt = new Date(Math.min(now.getTime() + AGREEMENT_HOURS * HOUR, start.getTime()));
  const title = await listingTitle(db, b.listingId);
  try {
    await db.transaction(async (tx) => {
      await moveBooking(tx, b, "accept", "owner", (actor as UserActor).id, { decidedAt: now, agreementDueAt });
      await createRentalContract(tx, b.id);
      await announce(tx, b, "booking.accepted", "booking_accepted", ["renter"], title);
    });
  } catch (err) {
    // The exclusion constraint: another booking already holds (part of) this period.
    if ((err as { cause?: { code?: string } }).cause?.code === "23P01") throw new AppError("conflict", "period_taken");
    throw err;
  }
}

export async function declineBooking(actor: Actor, bookingId: string): Promise<void> {
  const b = await loadBookingFor(actor, bookingId, "booking.respond");
  const title = await listingTitle(db, b.listingId);
  await db.transaction(async (tx) => {
    await moveBooking(tx, b, "decline", "owner", (actor as UserActor).id, { decidedAt: new Date() });
    await announce(tx, b, "booking.declined", "booking_declined", ["renter"], title);
  });
}

export async function withdrawBooking(actor: Actor, bookingId: string): Promise<void> {
  const b = await loadBookingFor(actor, bookingId, "booking.participate");
  if (roleOf(b, actor.kind === "user" ? actor.id : "") !== "renter") throw new AppError("forbidden");
  const title = await listingTitle(db, b.listingId);
  await db.transaction(async (tx) => {
    await moveBooking(tx, b, "withdraw", "renter", (actor as UserActor).id);
    await announce(tx, b, "booking.withdrawn", "booking_withdrawn", ["owner"], title);
  });
}

export const cancelSchema = z.object({
  bookingId: z.uuid(),
  reason: z.string().trim().min(3, { error: "reason_required" }).max(500, { error: "too_long" }),
});

/** Either party, before handover; the reason goes to the other party (DATA_MODEL §5). */
export async function cancelBooking(actor: Actor, input: z.infer<typeof cancelSchema>): Promise<void> {
  const b = await loadBookingFor(actor, input.bookingId, "booking.participate");
  const role = roleOf(b, (actor as UserActor).id)!;
  const title = await listingTitle(db, b.listingId);
  await db.transaction(async (tx) => {
    await moveBooking(tx, b, "cancel", role, (actor as UserActor).id, {
      cancelledAt: new Date(),
      cancelledBy: (actor as UserActor).id,
      cancelReason: input.reason,
    });
    await closeLiveContract(tx, { bookingId: b.id }, "void");
    await announce(tx, b, "booking.cancelled", "booking_cancelled", [role === "owner" ? "renter" : "owner"], title);
  });
}

// ---------------------------------------------------------------- agreement

/** «Jeg godtar avtalen»: the actor accepts the exact text (hash) they were shown (RENTAL_AGREEMENTS §3). */
export async function acceptAgreement(
  actor: Actor,
  bookingId: string,
  shownSha256: string,
  now = new Date(),
): Promise<"waiting" | "confirmed"> {
  const b = await loadBookingFor(actor, bookingId, "booking.participate");
  const role = roleOf(b, (actor as UserActor).id)!;
  if (b.status !== "accepted") throw new AppError("conflict", "agreement_not_open");
  if (b.agreementDueAt && b.agreementDueAt < now) throw new AppError("conflict", "agreement_expired");
  const title = await listingTitle(db, b.listingId);
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.bookingId, b.id), eq(contracts.status, "pending_acceptance")));
    if (!c) throw new AppError("conflict", "agreement_not_open");
    const roles = await recordAcceptance(tx, c.id, (actor as UserActor).id, role, shownSha256);
    if (!(roles.includes("owner") && roles.includes("renter"))) return "waiting";
    await markContractAccepted(tx, c.id);
    await moveBooking(tx, b, "agreement_accepted", role, (actor as UserActor).id, { confirmedAt: now });
    await announce(tx, b, "booking.confirmed", "booking_confirmed", ["owner", "renter"], title);
    return "confirmed";
  });
}

export const changeTermsSchema = z.object({
  bookingId: z.uuid(),
  start: z.iso.datetime({ offset: true, error: "date_invalid" }),
  end: z.iso.datetime({ offset: true, error: "date_invalid" }),
  handoverMethod: z.enum(HANDOVER_METHODS, { error: "required" }),
  returnMethod: z.enum(HANDOVER_METHODS, { error: "required" }),
});

/**
 * Material change before handover (RENTAL_AGREEMENTS §3.4): new period or handover/return method →
 * the live agreement is superseded, revision n+1 is created and both must accept again.
 */
export async function changeTerms(
  actor: Actor,
  input: z.infer<typeof changeTermsSchema>,
  now = new Date(),
): Promise<void> {
  const b = await loadBookingFor(actor, input.bookingId, "booking.participate");
  const role = roleOf(b, (actor as UserActor).id)!;
  const [l] = await db.select().from(listings).where(eq(listings.id, b.listingId));
  const allowed = { pickup: l!.handoverPickup, owner_delivery: l!.handoverOwnerDelivery, meet: l!.handoverMeet };
  const start = new Date(input.start);
  const end = new Date(input.end);
  const fieldErrors: Record<string, string> = {};
  if (!allowed[input.handoverMethod]) fieldErrors.handoverMethod = "method_not_offered";
  if (!allowed[input.returnMethod]) fieldErrors.returnMethod = "method_not_offered";
  const perr = periodError(start, end, b.priceUnit, now);
  if (perr) fieldErrors.start = perr;
  if (Object.keys(fieldErrors).length) throw new AppError("validation", "request_invalid", { fieldErrors });
  const n = units(start, end, b.priceUnit);
  const title = l!.title;
  try {
    await db.transaction(async (tx) => {
      await moveBooking(
        tx,
        b,
        "change_terms",
        role,
        (actor as UserActor).id,
        {
          period: toRange(start, end),
          units: n,
          totalPriceOre: totalOre(b.priceOre, n),
          handoverMethod: input.handoverMethod,
          returnMethod: input.returnMethod,
          deliveryFeeOre: input.handoverMethod === "owner_delivery" ? l!.deliveryFeeOre : null,
          agreementDueAt: new Date(Math.min(now.getTime() + AGREEMENT_HOURS * HOUR, start.getTime())),
          confirmedAt: null,
        },
        { changedBy: role },
      );
      await closeLiveContract(tx, { bookingId: b.id }, "superseded");
      await createRentalContract(tx, b.id);
      await announce(tx, b, "booking.new_revision", "agreement_new_revision", ["owner", "renter"], title);
    });
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23P01") throw new AppError("conflict", "period_taken");
    throw err;
  }
}

export const meetingPlaceSchema = z.object({
  bookingId: z.uuid(),
  place: z.string().trim().max(200, { error: "too_long" }),
});

/** The exact meeting place is shared with the other party only, never in the agreement text. */
export async function setMeetingPlace(actor: Actor, input: z.infer<typeof meetingPlaceSchema>): Promise<void> {
  const b = await loadBookingFor(actor, input.bookingId, "booking.participate");
  if (!["accepted", "confirmed", "handed_over", "return_pending", "not_returned"].includes(b.status))
    throw new AppError("conflict");
  await db
    .update(bookings)
    .set({ meetingPlacePrivate: input.place || null, updatedAt: new Date() })
    .where(eq(bookings.id, b.id));
}
