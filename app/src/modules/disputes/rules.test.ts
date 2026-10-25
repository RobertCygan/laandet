import { describe, expect, it } from "vitest";
import {
  canEscalate,
  canReopen,
  decodeRecommendation,
  encodeRecommendation,
  isOpen,
  reportedLate,
  type DisputeCategory,
  type DisputeStatus,
} from "./rules";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const t0 = new Date("2026-12-14T10:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("dispute rules (DISPUTE_POLICY §2–§3)", () => {
  it("open and closed statuses", () => {
    for (const s of ["awaiting_response", "in_negotiation", "support_review", "awaiting_documentation"] as const)
      expect(isOpen(s)).toBe(true);
    for (const s of ["resolved_by_agreement", "withdrawn", "closed_without_agreement", "referred_to_insurer"] as const)
      expect(isOpen(s)).toBe(false);
  });

  it("marks late reports, never refuses them: 48 h for visible damage, 14 days otherwise", () => {
    expect(reportedLate("damaged", t0, at(47 * HOUR))).toBe(false);
    expect(reportedLate("damaged", t0, at(49 * HOUR))).toBe(true);
    expect(reportedLate("missing_accessories", t0, at(49 * HOUR))).toBe(true);
    expect(reportedLate("not_as_described", t0, at(13 * DAY))).toBe(false);
    expect(reportedLate("not_as_described", t0, at(15 * DAY))).toBe(true);
    // Before the return, nothing is late.
    expect(reportedLate("not_returned", null, at(400 * DAY))).toBe(false);
  });

  it("escalation: after an answer, after the deadline, or at once for urgent categories", () => {
    const d = (status: DisputeStatus, category: DisputeCategory = "damaged") => ({
      status,
      category,
      responseDueAt: at(7 * DAY),
    });
    expect(canEscalate(d("awaiting_response"), at(DAY))).toBe(false);
    expect(canEscalate(d("awaiting_response"), at(8 * DAY))).toBe(true);
    expect(canEscalate(d("in_negotiation"), at(DAY))).toBe(true);
    expect(canEscalate(d("awaiting_response", "not_returned"), at(HOUR))).toBe(true);
    expect(canEscalate(d("awaiting_response", "unsafe_equipment"), at(HOUR))).toBe(true);
    expect(canEscalate(d("support_review"), at(DAY))).toBe(false);
    expect(canEscalate(d("resolved_by_agreement"), at(30 * DAY))).toBe(false);
  });

  it("reopening only within 30 days of closure, and only a case that was escalated", () => {
    const closed = { status: "closed_without_agreement", closedAt: t0, escalatedAt: at(-DAY) } as const;
    expect(canReopen(closed, at(29 * DAY))).toBe(true);
    expect(canReopen(closed, at(31 * DAY))).toBe(false);
    expect(canReopen({ status: "support_review", closedAt: null, escalatedAt: at(-DAY) }, at(DAY))).toBe(false);
    // M2: settled between the parties without Laandet → staff cannot pull it back in.
    expect(canReopen({ status: "resolved_by_agreement", closedAt: t0, escalatedAt: null }, at(DAY))).toBe(false);
  });

  it("recommendation round-trip, and garbage is ignored", () => {
    const r = {
      documented: "Bilder ved utlevering",
      disagreed: "Om riper var der før",
      recommendation: "Del kostnaden",
    };
    expect(decodeRecommendation(encodeRecommendation(r))).toEqual(r);
    expect(decodeRecommendation("not json")).toBeNull();
    expect(decodeRecommendation('{"documented":1}')).toBeNull();
    expect(decodeRecommendation(null)).toBeNull();
  });
});
