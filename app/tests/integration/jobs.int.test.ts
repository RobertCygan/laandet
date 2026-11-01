import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { addEntry, confirmReport } from "@/modules/condition/service";
import { expireClaims } from "@/modules/giveaways/jobs";
import { createClaim } from "@/modules/giveaways/service";
import { saveListing } from "@/modules/listings/service";
import {
  expireAgreements,
  expireBookingRequests,
  lapseHandovers,
  lapseReturns,
  sendReturnReminders,
} from "@/modules/rentals/jobs";
import { acceptBooking, requestBooking } from "@/modules/rentals/service";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";
import {
  ALL_CHECKED,
  bookingRow,
  confirmedBooking,
  DAY,
  entry,
  HOUR,
  inDays,
  noticesFor,
  reportRow,
  setRentalsOpen,
} from "./rental-fixtures";

const later = (h: number) => new Date(Date.now() + h * HOUR);

async function systemEvents(bookingId: string) {
  return owner
    .select({ event: schema.bookingEvents.event, to: schema.bookingEvents.toStatus })
    .from(schema.bookingEvents)
    .where(and(eq(schema.bookingEvents.bookingId, bookingId), isNull(schema.bookingEvents.actorId)));
}

async function request(fromDay: number, toDay: number) {
  const lender = await createUser();
  const renter = await createUser();
  const { id: listingId } = await saveListing(lender, await rentalDraft(), [], { intent: "publish" });
  const { id } = await requestBooking(renter, {
    listingId,
    start: inDays(fromDay).toISOString(),
    end: inDays(toDay).toISOString(),
    handoverMethod: "pickup",
    returnMethod: "pickup",
    message: "",
  });
  return { lender, renter, id };
}

async function handedOver() {
  const f = await confirmedBooking();
  await addEntry(f.lender, entry(f.id, "handover"), new Date(f.start.getTime() - HOUR));
  await confirmReport(f.renter, {
    bookingId: f.id,
    phase: "handover",
    decision: "confirm",
    checklist: ALL_CHECKED,
    comment: "",
  });
  await confirmReport(f.lender, {
    bookingId: f.id,
    phase: "handover",
    decision: "confirm",
    checklist: ALL_CHECKED,
    comment: "",
  });
  return f;
}

describe("worker jobs (P02-06), with a fake clock", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("booking_request_expiry: unanswered after 72 h → expired, once", async () => {
    const due = await request(10, 12);
    const fresh = await request(20, 22);
    // Asked later: its 72 h have not run out yet.
    await owner
      .update(schema.bookings)
      .set({ ownerResponseDueAt: later(100) })
      .where(eq(schema.bookings.id, fresh.id));
    expect(await expireBookingRequests(later(71))).toBe(0);
    expect(await expireBookingRequests(later(73))).toBe(1);
    expect(await expireBookingRequests(later(73))).toBe(0);
    expect((await bookingRow(due.id)).status).toBe("expired");
    expect((await bookingRow(fresh.id)).status).toBe("requested");
    expect(await systemEvents(due.id)).toEqual([{ event: "expire", to: "expired" }]);
    expect(await noticesFor(due.renter.id)).toContain("booking_expired");
  });

  it("agreement_expiry: accepted but not agreed in time → expired, contract void", async () => {
    const { lender, id } = await request(10, 12);
    await acceptBooking(lender, id);
    expect(await expireAgreements(later(47))).toBe(0);
    expect(await expireAgreements(later(49))).toBe(1);
    expect(await expireAgreements(later(49))).toBe(0);
    expect((await bookingRow(id)).status).toBe("expired");
    const [c] = await owner.select().from(schema.contracts).where(eq(schema.contracts.bookingId, id));
    expect(c?.status).toBe("void");
    expect(await systemEvents(id)).toEqual([{ event: "agreement_timeout", to: "expired" }]);
  });

  it("handover_lapse: one confirmation and 24 h after the start → handed over, report lapsed", async () => {
    const { lender, renter, id, start } = await confirmedBooking();
    const untouched = await confirmedBooking();
    await addEntry(lender, entry(id, "handover"), new Date(start.getTime() - HOUR));
    await confirmReport(lender, {
      bookingId: id,
      phase: "handover",
      decision: "confirm",
      checklist: ALL_CHECKED,
      comment: "",
    });
    expect(await lapseHandovers(new Date(start.getTime() + 23 * HOUR))).toBe(0);
    const at = new Date(start.getTime() + 25 * HOUR);
    expect(await lapseHandovers(at)).toBe(1);
    expect(await lapseHandovers(at)).toBe(0);
    expect((await bookingRow(id)).status).toBe("handed_over");
    expect((await reportRow(id, "handover"))?.status).toBe("lapsed");
    const [ev] = await owner
      .select()
      .from(schema.bookingEvents)
      .where(and(eq(schema.bookingEvents.bookingId, id), eq(schema.bookingEvents.event, "handover_lapsed")));
    expect(ev).toMatchObject({ actorId: null, metadata: { confirmedBy: "owner" } });
    expect(await noticesFor(renter.id)).toContain("handed_over");
    // Nobody confirmed anything on the other booking: it is left alone.
    expect((await bookingRow(untouched.id)).status).toBe("confirmed");
  });

  it("return_reminder: the renter at the end and 24 h later; the owner when «Ikke tilbakelevert» opens", async () => {
    const { lender, renter, id, end } = await handedOver();
    expect(await sendReturnReminders(new Date(end.getTime() - HOUR))).toBe(0);
    expect(await sendReturnReminders(new Date(end.getTime() + HOUR))).toBe(1);
    expect(await sendReturnReminders(new Date(end.getTime() + 2 * HOUR))).toBe(0);
    expect((await noticesFor(renter.id)).filter((t) => t === "return_reminder")).toHaveLength(1);
    expect(await sendReturnReminders(new Date(end.getTime() + DAY + HOUR))).toBe(1);
    expect(await sendReturnReminders(new Date(end.getTime() + DAY + 2 * HOUR))).toBe(0);
    expect((await noticesFor(renter.id)).filter((t) => t === "return_reminder")).toHaveLength(2);
    expect(await noticesFor(lender.id)).toContain("not_returned_possible");
    expect((await bookingRow(id)).remindersSent.sort()).toEqual(["end", "not_returned_possible"]);
  });

  it("return_lapse: no answer to the return entry for 72 h → completed with the proposed outcome", async () => {
    const { renter, id } = await handedOver();
    await addEntry(renter, entry(id, "return", { proposedOutcome: "returned_normal_wear" }), new Date());
    expect(await lapseReturns(later(71))).toBe(0);
    expect(await lapseReturns(later(73))).toBe(1);
    expect(await lapseReturns(later(73))).toBe(0);
    expect((await bookingRow(id)).status).toBe("completed");
    expect(await reportRow(id, "return")).toMatchObject({ status: "lapsed", returnOutcome: "returned_normal_wear" });
    expect(await systemEvents(id)).toEqual([{ event: "return_lapsed", to: "completed" }]);
  });

  it("giveaway_claim_expiry: claims unanswered for 14 days expire", async () => {
    const giver = await createUser();
    const a = await createUser();
    const draft = await rentalDraft({
      type: "give_away",
      priceOre: null,
      priceUnit: null,
      declaredValueOre: null,
      depositOre: null,
    });
    const { id: listingId } = await saveListing(giver, draft, [], { intent: "publish" });
    const { id } = await createClaim(a, { listingId, handoverMethod: undefined, message: "" });
    expect(await expireClaims(new Date(Date.now() + 13 * DAY))).toBe(0);
    expect(await expireClaims(new Date(Date.now() + 15 * DAY))).toBe(1);
    expect(await expireClaims(new Date(Date.now() + 15 * DAY))).toBe(0);
    const [g] = await owner.select().from(schema.giveawayClaims).where(eq(schema.giveawayClaims.id, id));
    expect(g?.status).toBe("expired");
    expect(await noticesFor(a.id)).toContain("claim_expired");
  });
});
