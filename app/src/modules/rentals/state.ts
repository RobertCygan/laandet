import type { BookingStatus } from "@/db/schema";

/**
 * Booking state machine (DATA_MODEL.md §5) as a pure, exhaustively tested table.
 * Time-based guards (deadlines, "24 h after the end") live in the services and worker jobs.
 */
export type BookingRole = "owner" | "renter" | "system";
export type BookingEvent =
  | "accept"
  | "decline"
  | "withdraw"
  | "expire"
  | "agreement_accepted"
  | "change_terms"
  | "agreement_timeout"
  | "cancel"
  | "handover_confirmed"
  | "handover_lapsed"
  | "return_recorded"
  | "return_agreed"
  | "return_contested"
  | "return_lapsed"
  | "mark_not_returned"
  | "open_dispute"
  | "dispute_closed";

type Rule = { to: BookingStatus; by: readonly BookingRole[] };
const PARTIES = ["owner", "renter"] as const;

export const TRANSITIONS: Partial<Record<BookingStatus, Partial<Record<BookingEvent, Rule>>>> = {
  requested: {
    accept: { to: "accepted", by: ["owner"] },
    decline: { to: "declined", by: ["owner"] },
    withdraw: { to: "withdrawn", by: ["renter"] },
    expire: { to: "expired", by: ["system"] },
  },
  accepted: {
    agreement_accepted: { to: "confirmed", by: PARTIES },
    change_terms: { to: "accepted", by: PARTIES },
    agreement_timeout: { to: "expired", by: ["system"] },
    cancel: { to: "cancelled", by: PARTIES },
  },
  confirmed: {
    change_terms: { to: "accepted", by: PARTIES },
    cancel: { to: "cancelled", by: PARTIES },
    handover_confirmed: { to: "handed_over", by: PARTIES },
    handover_lapsed: { to: "handed_over", by: ["system"] },
  },
  handed_over: {
    return_recorded: { to: "return_pending", by: PARTIES },
    mark_not_returned: { to: "not_returned", by: ["owner"] },
  },
  not_returned: {
    return_recorded: { to: "return_pending", by: PARTIES },
  },
  return_pending: {
    return_agreed: { to: "completed", by: PARTIES },
    return_contested: { to: "disputed", by: PARTIES },
    return_lapsed: { to: "completed", by: ["system"] },
  },
  completed: {
    open_dispute: { to: "disputed", by: PARTIES },
  },
  disputed: {
    dispute_closed: { to: "completed", by: ["system"] },
  },
};

export type TransitionResult =
  { ok: true; to: BookingStatus } | { ok: false; error: "invalid_transition" | "wrong_party" };

export function transition(from: BookingStatus, event: BookingEvent, role: BookingRole): TransitionResult {
  const rule = TRANSITIONS[from]?.[event];
  if (!rule) return { ok: false, error: "invalid_transition" };
  if (!rule.by.includes(role)) return { ok: false, error: "wrong_party" };
  return { ok: true, to: rule.to };
}

/** Statuses in which the period is held (the database exclusion constraint uses the same list). */
export const ACTIVE_STATUSES: readonly BookingStatus[] = ["accepted", "confirmed", "handed_over", "return_pending"];
export const TERMINAL_STATUSES: readonly BookingStatus[] = [
  "declined",
  "withdrawn",
  "expired",
  "cancelled",
  "completed",
];
