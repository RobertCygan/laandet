/**
 * Norwegian formats for money and dates, used in both locales (master spec §2):
 * `1 500 kr`, `14.12.2026`. Money is integer øre (DECISIONS D-009); no floats.
 */
export type Ore = number | bigint;

const NBSP = " ";
const TIME_ZONE = "Europe/Oslo";
const groupFormat = new Intl.NumberFormat("nb-NO", { useGrouping: true, maximumFractionDigits: 0 });

function toBigInt(ore: Ore): bigint {
  if (typeof ore === "bigint") return ore;
  if (!Number.isSafeInteger(ore)) {
    throw new RangeError(`Money must be a safe integer number of øre, got ${ore}`);
  }
  return BigInt(ore);
}

/** 150000 → "1 500 kr"; 123456789 → "1 234 567,89 kr" (non-breaking spaces). */
export function formatKr(ore: Ore): string {
  const value = toBigInt(ore);
  const negative = value < BigInt(0);
  const abs = negative ? -value : value;
  const hundred = BigInt(100);
  const kroner = abs / hundred;
  const rest = abs % hundred;
  // Intl.NumberFormat accepts bigint, so large values keep full precision.
  const whole = groupFormat.format(kroner).replace(/\s/g, NBSP);
  const decimals = rest === BigInt(0) ? "" : `,${rest.toString().padStart(2, "0")}`;
  return `${negative ? "−" : ""}${whole}${decimals}${NBSP}kr`;
}

/**
 * Parse a kroner amount typed by a user ("1 500", "1500", "1 500,50") into øre.
 * Returns null for anything that is not a valid non-negative amount with at most 2 decimals.
 */
export function parseKrToOre(input: string): number | null {
  const cleaned = input.replace(/[\s ]/g, "").replace(/kr$/i, "");
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const kroner = Number(match[1]);
  const decimals = match[2] ? Number(match[2].padEnd(2, "0")) : 0;
  return kroner * 100 + decimals;
}

/** Øre → plain input value for a form field: 150000 → "1500", 150050 → "1500,50". */
export function oreToInput(ore: Ore | null | undefined): string {
  if (ore === null || ore === undefined) return "";
  const value = toBigInt(ore);
  const hundred = BigInt(100);
  const rest = value % hundred;
  return `${value / hundred}${rest === BigInt(0) ? "" : `,${rest.toString().padStart(2, "0")}`}`;
}

function parts(date: Date) {
  const formatter = new Intl.DateTimeFormat("nb-NO", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) map[p.type] = p.value;
  return map as { day: string; month: string; year: string; hour: string; minute: string };
}

/** → "14.12.2026" (Europe/Oslo). */
export function formatDate(date: Date): string {
  const p = parts(date);
  return `${p.day}.${p.month}.${p.year}`;
}

/** Calendar date stored as "YYYY-MM-DD" → "14.12.2026" (no time-zone shift). */
export function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** nb → "14.12.2026 kl. 10:00", en → "14.12.2026, 10:00" (Europe/Oslo). */
export function formatDateTime(date: Date, locale: "nb" | "en"): string {
  const p = parts(date);
  const day = `${p.day}.${p.month}.${p.year}`;
  return locale === "nb" ? `${day} kl.${NBSP}${p.hour}:${p.minute}` : `${day}, ${p.hour}:${p.minute}`;
}

/** → "oktober 2026" / "October 2026". */
export function formatMonthYear(date: Date, locale: "nb" | "en"): string {
  return new Intl.DateTimeFormat(locale === "nb" ? "nb-NO" : "en-GB", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Form fields "2026-12-14" + "10:00", read as Europe/Oslo wall time (summer time included) → Date. */
export function osloLocalToDate(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!d || !t) return null;
  const wall = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess));
    guess += wall - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  if (Number.isNaN(guess)) return null;
  // Rejects 2026-02-30 and the like (Date.UTC rolls them over).
  const back = osloInputs(new Date(guess));
  return back.date === date ? new Date(guess) : null;
}

/** Date → the Europe/Oslo values for `<input type="date">` and `<input type="time">`. */
export function osloInputs(date: Date): { date: string; time: string } {
  const p = parts(date);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
