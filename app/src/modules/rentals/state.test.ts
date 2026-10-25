import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES, type BookingStatus } from "@/db/schema";
import { transition, TRANSITIONS, type BookingEvent, type BookingRole } from "./state";

const EVENTS: BookingEvent[] = [
  "accept",
  "decline",
  "withdraw",
  "expire",
  "agreement_accepted",
  "change_terms",
  "agreement_timeout",
  "cancel",
  "handover_confirmed",
  "handover_lapsed",
  "return_recorded",
  "return_agreed",
  "return_contested",
  "return_lapsed",
  "mark_not_returned",
  "open_dispute",
  "dispute_closed",
];
const ROLES: BookingRole[] = ["owner", "renter", "system"];

// DATA_MODEL.md §5, row by row: [from, event, role, to]
const ALLOWED: [BookingStatus, BookingEvent, BookingRole, BookingStatus][] = [
  ["requested", "accept", "owner", "accepted"],
  ["requested", "decline", "owner", "declined"],
  ["requested", "withdraw", "renter", "withdrawn"],
  ["requested", "expire", "system", "expired"],
  ["accepted", "agreement_accepted", "owner", "confirmed"],
  ["accepted", "agreement_accepted", "renter", "confirmed"],
  ["accepted", "change_terms", "owner", "accepted"],
  ["accepted", "change_terms", "renter", "accepted"],
  ["accepted", "agreement_timeout", "system", "expired"],
  ["accepted", "cancel", "owner", "cancelled"],
  ["accepted", "cancel", "renter", "cancelled"],
  ["confirmed", "change_terms", "owner", "accepted"],
  ["confirmed", "change_terms", "renter", "accepted"],
  ["confirmed", "cancel", "owner", "cancelled"],
  ["confirmed", "cancel", "renter", "cancelled"],
  ["confirmed", "handover_confirmed", "owner", "handed_over"],
  ["confirmed", "handover_confirmed", "renter", "handed_over"],
  ["confirmed", "handover_lapsed", "system", "handed_over"],
  ["handed_over", "return_recorded", "owner", "return_pending"],
  ["handed_over", "return_recorded", "renter", "return_pending"],
  ["handed_over", "mark_not_returned", "owner", "not_returned"],
  ["not_returned", "return_recorded", "owner", "return_pending"],
  ["not_returned", "return_recorded", "renter", "return_pending"],
  ["return_pending", "return_agreed", "owner", "completed"],
  ["return_pending", "return_agreed", "renter", "completed"],
  ["return_pending", "return_contested", "owner", "disputed"],
  ["return_pending", "return_contested", "renter", "disputed"],
  ["return_pending", "return_lapsed", "system", "completed"],
  ["completed", "open_dispute", "owner", "disputed"],
  ["completed", "open_dispute", "renter", "disputed"],
  ["disputed", "dispute_closed", "system", "completed"],
];

describe("booking state machine (every status × event × role)", () => {
  it.each(ALLOWED)("%s --%s(%s)--> %s", (from, event, role, to) => {
    expect(transition(from, event, role)).toEqual({ ok: true, to });
  });

  it("refuses every combination that is not in DATA_MODEL §5", () => {
    const allowed = new Set(ALLOWED.map(([f, e, r]) => `${f}|${e}|${r}`));
    let refused = 0;
    for (const from of BOOKING_STATUSES)
      for (const event of EVENTS)
        for (const role of ROLES) {
          if (allowed.has(`${from}|${event}|${role}`)) continue;
          expect(transition(from, event, role).ok, `${from}|${event}|${role}`).toBe(false);
          refused++;
        }
    expect(refused).toBe(BOOKING_STATUSES.length * EVENTS.length * ROLES.length - ALLOWED.length);
  });

  it("terminal statuses have no way out, except a completed rental can become a dispute", () => {
    for (const s of ["declined", "withdrawn", "expired", "cancelled"] as const) expect(TRANSITIONS[s]).toBeUndefined();
    expect(Object.keys(TRANSITIONS.completed ?? {})).toEqual(["open_dispute"]);
  });

  it("tells a wrong party apart from an impossible step", () => {
    expect(transition("requested", "accept", "renter")).toEqual({ ok: false, error: "wrong_party" });
    expect(transition("declined", "accept", "owner")).toEqual({ ok: false, error: "invalid_transition" });
  });
});
