/**
 * Pure messaging rules (P02-01). No database access, so client components may import them too.
 */
export const MESSAGE_MAX_LENGTH = 4000;

/** Booking and claim states in which a thread stays open even if one party has blocked the other. */
export const ACTIVE_BOOKING_STATUSES = [
  "requested",
  "accepted",
  "confirmed",
  "handed_over",
  "return_pending",
  "not_returned",
  "disputed",
] as const;
export const ACTIVE_CLAIM_STATUSES = ["requested", "selected"] as const;

const PAYMENT_PATTERNS: RegExp[] = [
  // Links to payment apps, banks or payment pages.
  /\b(?:https?:\/\/|www\.)\S*(?:vipps|paypal|revolut|klarna|stripe|betal|payment|pay\.|bank)\S*/i,
  // "Pay here / via this link" in Norwegian and English.
  /\bbetal\s+(?:her|via|med\s+denne|på\s+lenken|gjennom\s+lenken)\b/i,
  /\bpay\s+(?:here|via\s+(?:this|the)\s+link|using\s+this\s+link)\b/i,
  // Requests for BankID or one-time codes.
  /\bbank\s?-?id\s*-?\s*(?:kode|code|passord|password)/i,
  /\b(?:send|gi|oppgi|share|give)\s+(?:meg\s+|me\s+)?(?:(?:engangs)?koden|kode(?:n)?|the\s+code|your\s+code|engangskode)\b/i,
];

/**
 * A gentle hint, not a block: true when a message looks like a payment link or asks for a BankID or
 * one-time code. Laandet never sends payment links (RENTAL_AGREEMENTS §5).
 */
export function paymentWarning(body: string): boolean {
  return PAYMENT_PATTERNS.some((re) => re.test(body));
}
