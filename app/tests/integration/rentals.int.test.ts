import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { changeListingStatus, saveListing } from "@/modules/listings/service";
import {
  acceptAgreement,
  acceptBooking,
  cancelBooking,
  changeTerms,
  declineBooking,
  requestBooking,
} from "@/modules/rentals/service";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString();
const inDays = (n: number, hour = 10) => {
  const d = new Date(Date.now() + n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

async function setRentalsOpen(on: boolean) {
  await owner
    .insert(schema.featureFlags)
    .values({ key: "rentals_open", enabled: on, description: "test" })
    .onConflictDoUpdate({ target: schema.featureFlags.key, set: { enabled: on } });
}

async function setup() {
  const lender = await createUser({ name: "Utleier U." });
  const renter = await createUser({ name: "Leietaker L." });
  const { id: listingId } = await saveListing(lender, await rentalDraft(), [], { intent: "publish" });
  return { lender, renter, listingId };
}

const req = (listingId: string, from: number, to: number) => ({
  listingId,
  start: iso(inDays(from)),
  end: iso(inDays(to)),
  handoverMethod: "pickup" as const,
  returnMethod: "pickup" as const,
  message: "",
});

describe("rental requests and bookings (P02-02, P02-04)", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("request → accept → agreement → both accept → confirmed, with history and notices", async () => {
    const { lender, renter, listingId } = await setup();
    const { id } = await requestBooking(renter, req(listingId, 3, 5));
    let [b] = await owner.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b).toMatchObject({
      status: "requested",
      units: 2,
      totalPriceOre: 30000,
      depositOre: 50000,
      valueCategory: "A",
    });

    await acceptBooking(lender, id);
    const [c] = await owner.select().from(schema.contracts).where(eq(schema.contracts.bookingId, id));
    expect(c).toMatchObject({ status: "pending_acceptance", revision: 1, kind: "rental_simple" });
    expect(c!.agreementNumber).toMatch(/^LA-\d{4}-\d{6}$/);
    expect(c!.renderedText).toContain("Leietaker L.");

    // A stale or forged hash is refused.
    await expect(acceptAgreement(renter, id, "0".repeat(64))).rejects.toMatchObject({
      code: "conflict",
      message: "agreement_changed",
    });
    expect(await acceptAgreement(renter, id, c!.renderedSha256)).toBe("waiting");
    expect(await acceptAgreement(lender, id, c!.renderedSha256)).toBe("confirmed");
    [b] = await owner.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b!.status).toBe("confirmed");
    const events = await owner
      .select({ e: schema.bookingEvents.event })
      .from(schema.bookingEvents)
      .where(eq(schema.bookingEvents.bookingId, id));
    expect(events.map((x) => x.e)).toEqual(["request", "accept", "agreement_accepted"]);
    const notices = await owner.select().from(schema.notifications).where(eq(schema.notifications.userId, renter.id));
    expect(notices.map((n) => n.type)).toEqual(expect.arrayContaining(["booking_accepted", "booking_confirmed"]));
    const system = await owner
      .select({ body: schema.messages.body })
      .from(schema.messages)
      .where(and(eq(schema.messages.conversationId, b!.conversationId), eq(schema.messages.kind, "system")));
    expect(system.map((m) => m.body)).toEqual(["booking.requested", "booking.accepted", "booking.confirmed"]);
  });

  it("overlapping periods: many may ask, but only one can be accepted (exclusion constraint)", async () => {
    const { lender, renter, listingId } = await setup();
    const other = await createUser();
    const a = await requestBooking(renter, req(listingId, 3, 6));
    const b = await requestBooking(other, req(listingId, 4, 7));
    await acceptBooking(lender, a.id);
    await expect(acceptBooking(lender, b.id)).rejects.toMatchObject({ code: "conflict", message: "period_taken" });
    // Directly in the database too.
    const [copy] = await owner.select().from(schema.bookings).where(eq(schema.bookings.id, b.id));
    await expect(owner.execute(sql`UPDATE bookings SET status = 'accepted' WHERE id = ${copy!.id}`)).rejects.toThrow();
  });

  it("only the parties: another user gets not_found, the renter cannot accept their own request", async () => {
    const { lender, renter, listingId } = await setup();
    const stranger = await createUser();
    const { id } = await requestBooking(renter, req(listingId, 3, 4));
    await expect(acceptBooking(stranger, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(acceptBooking(renter, id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(requestBooking(lender, req(listingId, 3, 4))).rejects.toMatchObject({
      code: "forbidden",
      message: "own_listing",
    });
    await declineBooking(lender, id);
  });

  it("refuses requests while rentals are closed, and for blocked pairs", async () => {
    const { lender, renter, listingId } = await setup();
    await setRentalsOpen(false);
    await expect(requestBooking(renter, req(listingId, 3, 4))).rejects.toMatchObject({ code: "feature_disabled" });
    await setRentalsOpen(true);
    await owner.insert(schema.userBlocks).values({ blockerId: lender.id, blockedId: renter.id });
    await expect(requestBooking(renter, req(listingId, 3, 4))).rejects.toMatchObject({
      code: "forbidden",
      message: "blocked",
    });
  });

  it("N4: a booking above 5 000 kr can never be stored", async () => {
    const { renter, lender, listingId } = await setup();
    const { id } = await requestBooking(renter, req(listingId, 3, 4));
    await expect(
      owner.execute(sql`UPDATE bookings SET value_category = 'B', declared_value_ore = 600000 WHERE id = ${id}`),
    ).rejects.toThrow();
    // The service refuses listings above the threshold even if one slipped through.
    await owner.update(schema.listings).set({ declaredValueOre: 600_000 }).where(eq(schema.listings.id, listingId));
    await expect(requestBooking(renter, req(listingId, 10, 11))).rejects.toMatchObject({
      message: "high_value_blocked",
    });
    void lender;
  });

  it("a change of terms supersedes the agreement and both must accept again; cancel voids it", async () => {
    const { lender, renter, listingId } = await setup();
    const { id } = await requestBooking(renter, req(listingId, 3, 5));
    await acceptBooking(lender, id);
    const [c1] = await owner.select().from(schema.contracts).where(eq(schema.contracts.bookingId, id));
    await acceptAgreement(renter, id, c1!.renderedSha256);
    await changeTerms(lender, {
      bookingId: id,
      start: iso(inDays(3)),
      end: iso(inDays(6)),
      handoverMethod: "pickup",
      returnMethod: "pickup",
    });
    const all = await owner.select().from(schema.contracts).where(eq(schema.contracts.bookingId, id));
    expect(all.map((c) => [c.revision, c.status]).sort()).toEqual([
      [1, "superseded"],
      [2, "pending_acceptance"],
    ]);
    // The old acceptance does not carry over.
    await expect(acceptAgreement(renter, id, c1!.renderedSha256)).rejects.toMatchObject({
      message: "agreement_changed",
    });
    await cancelBooking(renter, { bookingId: id, reason: "Fikk låne av naboen" });
    const after = await owner
      .select({ s: schema.contracts.status })
      .from(schema.contracts)
      .where(eq(schema.contracts.bookingId, id));
    expect(after.map((x) => x.s).sort()).toEqual(["superseded", "void"]);
  });

  it("the runtime role cannot alter an agreement text or forge an acceptance", async () => {
    const { lender, renter, listingId } = await setup();
    const { id } = await requestBooking(renter, req(listingId, 3, 5));
    await acceptBooking(lender, id);
    const { db } = await import("@/db/client");
    const [c] = await owner.select().from(schema.contracts).where(eq(schema.contracts.bookingId, id));
    await expect(db.execute(sql`UPDATE contracts SET rendered_text = 'x' WHERE id = ${c!.id}`)).rejects.toThrow();
    const stranger = await createUser();
    await expect(
      db.execute(
        sql`INSERT INTO contract_acceptances (contract_id, user_id, party_role, accepted_sha256) VALUES (${c!.id}, ${stranger.id}, 'renter', ${c!.renderedSha256})`,
      ),
    ).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM booking_events WHERE booking_id = ${id}`)).rejects.toThrow();
  });

  it("a listing cannot be archived or deleted during a booking; open requests are declined", async () => {
    const { lender, renter, listingId } = await setup();
    const other = await createUser();
    const active = await requestBooking(renter, req(listingId, 3, 5));
    const open = await requestBooking(other, req(listingId, 10, 12));
    await acceptBooking(lender, active.id);
    await expect(changeListingStatus(lender, listingId, "archive")).rejects.toMatchObject({
      code: "conflict",
      message: "listing_in_use",
    });
    await cancelBooking(lender, { bookingId: active.id, reason: "Verktøyet er ødelagt" });
    await changeListingStatus(lender, listingId, "delete");
    const [b] = await owner.select().from(schema.bookings).where(eq(schema.bookings.id, open.id));
    expect(b!.status).toBe("declined");
  });
});
