# P02-05 — Handover and return condition reports with photos

## GOAL
At handover and at return, both parties record the item's condition in about 2 minutes on a phone. Nobody can
change what the other wrote. The record says honestly whether they agree, disagree, or one did not answer.

## CONTEXT
- CONDITION_REPORTS §1–§9 (acceptance criteria §9). DATA_MODEL §5 rows from `confirmed` onward.

## INPUT
- Confirmed bookings (P02-04). The image pipeline (P01-09) with scope `condition`.

## OUTPUT
1. **Pages:** `/leieforhold/[id]/utlevering` and `/leieforhold/[id]/tilbakelevering`.
   - Each shows the current view, the full history («Vis historikk»), and who still has to confirm.
   - The central return rule is shown in the return form.
2. **Entries:**
   - fields per CONDITION_REPORTS §3 for category A;
   - photos (camera opens directly, `capture="environment"`) re-encoded and stripped of metadata;
   - corrections are new entries that supersede the author's own earlier entry.
3. **Confirm / contest** with the handover checklist. A confirmation counts only for the latest entry.
4. **Transitions:**
   - both confirm the handover → booking `handed_over`;
   - a return entry → `return_pending`;
   - both confirm `returned_ok` or `returned_normal_wear` → `completed`;
   - `returned_with_deviation` confirmed by both → `completed`;
   - a contest → `disputed`, with a minimal dispute record (the full dispute flow is P03-01).
5. **«Ikke tilbakelevert»:** the owner can mark it from 24 h after the end of the period, after the automatic reminder.
6. **Media:** condition photos are visible only to the two booking parties (404 for others).

## CONSTRAINTS
- Entries, photos and confirmations are append-only (database privileges).
- The platform never decides the damage category. It records what each party says.
- «Bekreftet av én part» is never shown as joint agreement.

## TESTS
1. Integration:
   - neither party can change or delete an entry (privileges);
   - a new entry invalidates earlier confirmations;
   - both confirmations → `handed_over`;
   - a contested return → `disputed` + dispute row.
2. Integration: N13. User C cannot fetch condition photos of booking A–B (404).
3. e2e: handover and return recorded by both parties at a 390 px viewport, and the booking is `completed`.
