import type { BookingStatus } from "@/db/schema";

/**
 * Dispute rules (DISPUTE_POLICY.md §2–§3) as pure functions, so they can be tested without a database.
 * Laandet facilitates; it never decides who is right and never moves money.
 */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** DISPUTE_POLICY §3 (configurable deadlines). */
export const DISPUTE_DEADLINES = {
  visibleDamageHours: 48,
  hiddenDefectDays: 14,
  responseDays: 7,
  documentationDays: 7,
  reopenDays: 30,
  grantDays: 30,
};

export type DisputeStatus =
  | "awaiting_response"
  | "in_negotiation"
  | "support_review"
  | "awaiting_documentation"
  | "resolved_by_agreement"
  | "withdrawn"
  | "closed_without_agreement"
  | "referred_to_insurer"
  | "referred_to_authority";

export type DisputeCategory =
  | "damaged"
  | "not_returned"
  | "not_as_described"
  | "missing_accessories"
  | "late_return"
  | "payment_disagreement"
  | "deposit_disagreement"
  | "unsafe_equipment"
  | "other";

export type ClosedDisputeStatus =
  "resolved_by_agreement" | "withdrawn" | "closed_without_agreement" | "referred_to_insurer" | "referred_to_authority";

export const OPEN_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  "awaiting_response",
  "in_negotiation",
  "support_review",
  "awaiting_documentation",
];
export const STAFF_CLOSURES = ["closed_without_agreement", "referred_to_insurer", "referred_to_authority"] as const;

export const isOpen = (s: DisputeStatus) => OPEN_DISPUTE_STATUSES.includes(s);

/** «Meld fra om et problem» is offered from the handover onwards (DISPUTE_POLICY §2 step 1). */
export const REPORTABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  "handed_over",
  "return_pending",
  "not_returned",
  "completed",
  "disputed",
];

/** Safety-first categories: escalation is available at once. */
export const URGENT_CATEGORIES: readonly DisputeCategory[] = ["not_returned", "unsafe_equipment"];

/**
 * A case opened after the recommended Laandet deadline is still accepted, but marked
 * «meldt etter anbefalt frist»: 48 h after the return for visible damage and missing accessories,
 * 14 days for everything else. Before the item is back, nothing is late.
 */
export function reportedLate(category: DisputeCategory, returnedAt: Date | null, now: Date): boolean {
  if (!returnedAt) return false;
  const limit =
    category === "damaged" || category === "missing_accessories"
      ? DISPUTE_DEADLINES.visibleDamageHours * HOUR
      : DISPUTE_DEADLINES.hiddenDefectDays * DAY;
  return now.getTime() > returnedAt.getTime() + limit;
}

/**
 * «Be Laandet om hjelp»: after the respondent has answered without agreement, after the response
 * deadline, or at once for `not_returned` and `unsafe_equipment` (DISPUTE_POLICY §2 step 4).
 */
export function canEscalate(
  d: { status: DisputeStatus; category: DisputeCategory; responseDueAt: Date },
  now: Date,
): boolean {
  if (d.status === "in_negotiation") return true;
  if (d.status !== "awaiting_response") return false;
  return URGENT_CATEGORIES.includes(d.category) || now.getTime() > d.responseDueAt.getTime();
}

/** Staff may reopen a closed case within 30 days if new information appears (audited). */
export function canReopen(d: { status: DisputeStatus; closedAt: Date | null }, now: Date): boolean {
  if (isOpen(d.status) || !d.closedAt) return false;
  return now.getTime() <= d.closedAt.getTime() + DISPUTE_DEADLINES.reopenDays * DAY;
}

/** The three-part, non-binding staff recommendation, stored as JSON in the event body. */
export type Recommendation = { documented: string; disagreed: string; recommendation: string };

export function encodeRecommendation(r: Recommendation): string {
  return JSON.stringify(r);
}

export function decodeRecommendation(body: string | null): Recommendation | null {
  if (!body) return null;
  try {
    const v = JSON.parse(body) as Partial<Recommendation>;
    if (typeof v.documented !== "string" || typeof v.disagreed !== "string" || typeof v.recommendation !== "string")
      return null;
    return { documented: v.documented, disagreed: v.disagreed, recommendation: v.recommendation };
  } catch {
    return null;
  }
}
