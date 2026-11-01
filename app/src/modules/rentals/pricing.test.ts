import { describe, expect, it } from "vitest";
import { fromRange, periodError, toRange, totalOre, units } from "./pricing";

const at = (iso: string) => new Date(iso);
const now = at("2026-12-01T12:00:00Z");

describe("rental units and price", () => {
  it.each([
    ["2026-12-14T09:00:00Z", "2026-12-14T10:00:00Z", "hour", 1],
    ["2026-12-14T09:00:00Z", "2026-12-14T10:01:00Z", "hour", 2],
    ["2026-12-14T09:00:00Z", "2026-12-15T09:00:00Z", "day", 1],
    ["2026-12-14T09:00:00Z", "2026-12-15T09:00:01Z", "day", 2],
    ["2026-12-18T16:00:00Z", "2026-12-20T20:00:00Z", "weekend", 1],
    ["2026-12-14T09:00:00Z", "2026-12-21T09:00:00Z", "week", 1],
    ["2026-12-14T09:00:00Z", "2026-12-22T09:00:00Z", "week", 2],
  ] as const)("%s → %s per %s = %i", (s, e, unit, n) => {
    expect(units(at(s), at(e), unit)).toBe(n);
  });

  it("multiplies in øre without floating point", () => {
    expect(totalOre(15000, 3)).toBe(45000);
    expect(totalOre(0, 5)).toBe(0);
  });

  it("validates the period", () => {
    expect(periodError(at("2026-12-14T10:00:00Z"), at("2026-12-14T09:00:00Z"), "day", now)).toBe("period_order");
    expect(periodError(at("2026-11-30T10:00:00Z"), at("2026-12-02T09:00:00Z"), "day", now)).toBe("period_in_past");
    expect(periodError(at("2026-12-02T10:00:00Z"), at("2027-03-02T09:00:00Z"), "day", now)).toBe("period_too_long");
    expect(periodError(at("2027-08-02T10:00:00Z"), at("2027-08-03T09:00:00Z"), "day", now)).toBe(
      "period_too_far_ahead",
    );
    expect(periodError(at("2026-12-02T10:00:00Z"), at("2027-01-02T10:00:00Z"), "hour", now)).toBe("too_many_units");
    expect(periodError(at("2026-12-14T09:00:00Z"), at("2026-12-15T09:00:00Z"), "day", now)).toBeNull();
  });

  it("round-trips PostgreSQL ranges", () => {
    const r = fromRange('["2026-12-14 09:00:00+00","2026-12-15 09:00:00+00")');
    expect(r.start.toISOString()).toBe("2026-12-14T09:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-12-15T09:00:00.000Z");
    expect(toRange(r.start, r.end)).toBe("[2026-12-14T09:00:00.000Z,2026-12-15T09:00:00.000Z)");
  });
});
