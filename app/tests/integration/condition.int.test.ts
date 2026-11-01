import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  addEntry,
  confirmReport,
  decisions,
  markNotReturned,
  mayViewConditionMedia,
} from "@/modules/condition/service";
import { uploadImage } from "@/modules/media/service";
import { createUser, owner, resetDb } from "./helpers";
import {
  ALL_CHECKED,
  bookingRow,
  confirmedBooking,
  DAY,
  entry,
  HOUR,
  noticesFor,
  reportRow,
  setRentalsOpen,
} from "./rental-fixtures";

const confirm = (
  bookingId: string,
  phase: "handover" | "return",
  checklist: Record<string, boolean> = ALL_CHECKED,
) => ({
  bookingId,
  phase,
  decision: "confirm" as const,
  checklist,
  comment: "",
});

async function photo() {
  const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#406080" } })
    .png()
    .toBuffer();
  return new File([new Uint8Array(png)], "tilstand.png", { type: "image/png" });
}

describe("condition reports (P02-05)", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("handover: own entries, both confirm with the checklist → handed over; return → completed", async () => {
    const { lender, renter, id, start, end } = await confirmedBooking();
    // Not earlier than 48 h before the start.
    await expect(addEntry(lender, entry(id, "handover"), new Date(start.getTime() - 49 * HOUR))).rejects.toMatchObject({
      message: "handover_too_early",
    });
    const before = new Date(start.getTime() - HOUR);
    await addEntry(lender, entry(id, "handover", { existingDamage: "Riper på håndtaket" }), before);
    // The notice goes to exactly the other party.
    expect(await noticesFor(renter.id)).toContain("condition_to_confirm");
    expect(await noticesFor(lender.id)).not.toContain("condition_to_confirm");

    await expect(
      confirmReport(renter, confirm(id, "handover", { ...ALL_CHECKED, instructions_given: false })),
    ).rejects.toMatchObject({ message: "checklist_incomplete" });
    expect(await confirmReport(renter, confirm(id, "handover"))).toBe("waiting");
    expect(await confirmReport(lender, confirm(id, "handover"))).toBe("agreed");
    expect((await bookingRow(id)).status).toBe("handed_over");
    expect((await reportRow(id, "handover"))?.status).toBe("agreed");

    // Return: the renter records it; the owner confirms; both confirmed → completed with the outcome.
    await addEntry(renter, entry(id, "return", { proposedOutcome: "returned_normal_wear" }), end);
    expect((await bookingRow(id)).status).toBe("return_pending");
    expect(await confirmReport(renter, confirm(id, "return", {}))).toBe("waiting");
    expect(await confirmReport(lender, confirm(id, "return", {}))).toBe("agreed");
    const done = await bookingRow(id);
    expect(done.status).toBe("completed");
    expect(await reportRow(id, "return")).toMatchObject({ status: "agreed", returnOutcome: "returned_normal_wear" });
    const events = await owner
      .select({ e: schema.bookingEvents.event })
      .from(schema.bookingEvents)
      .where(eq(schema.bookingEvents.bookingId, id));
    expect(events.map((x) => x.e)).toEqual([
      "request",
      "accept",
      "agreement_accepted",
      "handover_confirmed",
      "return_recorded",
      "return_agreed",
    ]);
  });

  it("a newer entry resets earlier confirmations; a correction may only replace the author's own entry", async () => {
    const { lender, renter, id, start } = await confirmedBooking();
    const now = new Date(start.getTime() - HOUR);
    await addEntry(lender, entry(id, "handover"), now);
    await confirmReport(renter, confirm(id, "handover"));
    const report = (await reportRow(id, "handover"))!;
    expect(await decisions(owner, report.id)).toMatchObject({ seq: 1, renter: "confirm", owner: null });

    const [first] = await owner
      .select()
      .from(schema.conditionEntries)
      .where(eq(schema.conditionEntries.reportId, report.id));
    await addEntry(lender, entry(id, "handover", { supersedesEntryId: first!.id, notes: "Glemte laderen" }), now);
    expect(await decisions(owner, report.id)).toMatchObject({ seq: 2, renter: null, owner: null });

    // The renter cannot supersede the owner's entry (service and database trigger).
    await expect(addEntry(renter, entry(id, "handover", { supersedesEntryId: first!.id }), now)).rejects.toMatchObject({
      code: "not_found",
    });
    // Entries are append-only for the app role.
    const [priv] = (
      await owner.execute<{ upd: boolean; del: boolean }>(
        sql`SELECT has_table_privilege('laandet_app', 'condition_entries', 'UPDATE') AS upd,
                   has_table_privilege('laandet_app', 'condition_entries', 'DELETE') AS del`,
      )
    ).rows;
    expect(priv).toEqual({ upd: false, del: false });
  });

  it("a contested return opens a dispute for the booking", async () => {
    const { lender, renter, id, start, end } = await confirmedBooking();
    await addEntry(lender, entry(id, "handover"), new Date(start.getTime() - HOUR));
    await confirmReport(renter, confirm(id, "handover"));
    await confirmReport(lender, confirm(id, "handover"));
    await addEntry(renter, entry(id, "return", { proposedOutcome: "returned_ok" }), end);
    await expect(
      confirmReport(lender, { bookingId: id, phase: "return", decision: "contest", checklist: {}, comment: "" }),
    ).rejects.toMatchObject({ message: "entry_invalid" });
    expect(
      await confirmReport(lender, {
        bookingId: id,
        phase: "return",
        decision: "contest",
        checklist: {},
        comment: "Batteriet mangler",
      }),
    ).toBe("contested");
    expect((await bookingRow(id)).status).toBe("disputed");
    const [d] = await owner.select().from(schema.disputes).where(eq(schema.disputes.bookingId, id));
    expect(d).toMatchObject({ openedBy: lender.id, respondentId: renter.id, status: "awaiting_response" });
    expect(await noticesFor(renter.id)).toContain("booking_disputed");
  });

  it("«Ikke tilbakelevert» only by the owner, and only 24 h after the end", async () => {
    const { lender, renter, id, start, end } = await confirmedBooking();
    await addEntry(lender, entry(id, "handover"), new Date(start.getTime() - HOUR));
    await confirmReport(renter, confirm(id, "handover"));
    await confirmReport(lender, confirm(id, "handover"));
    await expect(markNotReturned(lender, id, new Date(end.getTime() + 23 * HOUR))).rejects.toMatchObject({
      message: "not_returned_too_early",
    });
    await expect(markNotReturned(renter, id, new Date(end.getTime() + DAY + HOUR))).rejects.toMatchObject({
      code: "forbidden",
    });
    await markNotReturned(lender, id, new Date(end.getTime() + DAY + HOUR));
    expect((await bookingRow(id)).status).toBe("not_returned");
    // A late return can still be recorded.
    await addEntry(renter, entry(id, "return", { proposedOutcome: "returned_ok" }), new Date());
    expect((await bookingRow(id)).status).toBe("return_pending");
  });

  it("N13: condition photos are visible to the two parties only", async () => {
    const { lender, renter, id, start } = await confirmedBooking();
    const stranger = await createUser();
    const staff = await createUser({ role: "admin", staff2fa: true });
    const up = await uploadImage(lender, await photo(), "condition");
    const [m] = await owner.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.id, up.id));
    expect(m?.scope).toBe("condition");
    // Before it is attached: only the uploader.
    expect(await mayViewConditionMedia(lender, up.id, m!.uploadedBy)).toBe(true);
    expect(await mayViewConditionMedia(renter, up.id, m!.uploadedBy)).toBe(false);

    await addEntry(lender, entry(id, "handover", { photoIds: [up.id] }), new Date(start.getTime() - HOUR));
    expect(await mayViewConditionMedia(lender, up.id, m!.uploadedBy)).toBe(true);
    expect(await mayViewConditionMedia(renter, up.id, m!.uploadedBy)).toBe(true);
    expect(await mayViewConditionMedia(stranger, up.id, m!.uploadedBy)).toBe(false);
    expect(await mayViewConditionMedia(staff, up.id, m!.uploadedBy)).toBe(false);

    // A photo can be attached once, and only by its uploader.
    await expect(
      addEntry(renter, entry(id, "handover", { photoIds: [up.id] }), new Date(start.getTime() - HOUR)),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
