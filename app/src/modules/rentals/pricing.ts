import type { PriceUnit } from "@/db/schema";

/** Rental price arithmetic (pure; used by the request form preview and by the server). */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** A «helg» covers up to three days (for example Friday afternoon to Sunday evening). */
const UNIT_MS: Record<PriceUnit, number> = { hour: HOUR, day: DAY, weekend: 3 * DAY, week: 7 * DAY };

export const MAX_UNITS = 366;
export const MAX_PERIOD_DAYS = 60;
export const MAX_START_AHEAD_DAYS = 180;

export type PeriodError =
  "period_order" | "period_in_past" | "period_too_long" | "period_too_far_ahead" | "too_many_units";

export function units(start: Date, end: Date, unit: PriceUnit): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / UNIT_MS[unit]));
}

export function totalOre(priceOre: number, n: number): number {
  const total = priceOre * n;
  if (!Number.isSafeInteger(total)) throw new RangeError("total out of range");
  return total;
}

/** Validates a requested period; `now` is injectable for tests. */
export function periodError(start: Date, end: Date, unit: PriceUnit, now = new Date()): PeriodError | null {
  if (!(end.getTime() > start.getTime())) return "period_order";
  if (start.getTime() < now.getTime() - 15 * 60 * 1000) return "period_in_past";
  if (end.getTime() - start.getTime() > MAX_PERIOD_DAYS * DAY) return "period_too_long";
  if (start.getTime() - now.getTime() > MAX_START_AHEAD_DAYS * DAY) return "period_too_far_ahead";
  if (units(start, end, unit) > MAX_UNITS) return "too_many_units";
  return null;
}

/** `[start,end)` as a PostgreSQL tstzrange literal. */
export function toRange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}

/** Parses a tstzrange returned by PostgreSQL (`["2026-12-14 09:00:00+00","2026-12-15 09:00:00+00")`). */
export function fromRange(range: string): { start: Date; end: Date } {
  const m = /^[[(]"?([^",]+)"?,"?([^")\]]+)"?[)\]]$/.exec(range.trim());
  if (!m) throw new Error(`invalid range ${range}`);
  return {
    start: new Date(m[1]!.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")),
    end: new Date(m[2]!.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")),
  };
}
