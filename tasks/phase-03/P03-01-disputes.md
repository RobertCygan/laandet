# P03-01 — Dispute workflow (steps 1–6)

## GOAL
When something goes wrong in a rental, the two parties can document it, answer each other and agree on a solution.
If they cannot, Laandet staff can help without ever deciding who is right.

## CONTEXT
- `docs/DISPUTE_POLICY.md` (the whole workflow, deadlines, fairness checklist).
- `docs/AUTH_MODEL.md` §4–5 (party-only access, staff through time-boxed grants).
- `docs/PRIVACY.md` (disputes are private; retention 3 years after closure).
- The legal text `legal/nb/retningslinjer-for-tvister.md`.

## INPUT
- Bookings, condition reports, the minimal `disputes` row from P02-05.
- The tables `dispute_events`, `dispute_proposals`, `support_access_grants` (migration `0005_trust`, rules in `0006_trust_rules`).

## OUTPUT
1. **«Meld fra om et problem»** on a booking in `handed_over`, `return_pending`, `not_returned`, `completed` or `disputed`:
   - category, description (10–4 000 characters), optional photos;
   - the safety screen first for `unsafe_equipment` (stop using it; 113 / 112 / 110);
   - a case opened after the recommended deadline is accepted and marked «meldt etter anbefalt frist»;
   - one open case per booking; a completed booking moves to `disputed`.
2. **Case page `/saker/[id]`** for the two parties:
   - statements, photos (same pipeline as condition photos, scope `dispute`), references to the condition reports and to messages in the booking conversation;
   - the respondent's first answer moves the case to `in_negotiation`.
3. **Proposals:** the seven types in DISPUTE_POLICY §2. The other party accepts, rejects or makes a counter-proposal (the earlier pending one becomes `superseded`). Nobody accepts their own (database `CHECK` and trigger). Accepted → `resolved_by_agreement`, shown as «Avtalt løsning».
4. **«Be Laandet om hjelp»:** after an answer without agreement, after the 7-day deadline, or at once for `not_returned` and `unsafe_equipment` → `support_review`. Both parties are told that support will read the case.
5. **Staff (`/admin/saker`):**
   - the queue of cases in `support_review` and `awaiting_documentation`;
   - «Ta saken» creates a 30-day `support_access_grant` with a reason; every view is audited (`staff.view_dispute`);
   - ask for documentation (→ `awaiting_documentation`, 7 days), support notes (`staff_only` or `parties`);
   - a non-binding recommendation in three parts: «Dette er dokumentert», «Dette er partene uenige om», «Vår anbefaling (ikke bindende)». Both parties accept → `resolved_by_agreement`;
   - close as `closed_without_agreement` (with neutral information on external options), `referred_to_insurer` or `referred_to_authority`; reopen within 30 days (audited).
   - With an active grant, staff can see the booking's condition photos and the referenced messages; without it, 404.
6. **Withdraw:** the opener can withdraw while the case is open.
7. **Closure:** a `disputed` booking returns to `completed`. The case stays visible to both parties.
8. **Notices** to the other party for every step (in-app and essential email, never the text).

## CONSTRAINTS
- Facilitate, never adjudicate. No money moves. Neutral wording: «sak under behandling», never «svindel» or «tyveri».
- Cases never appear on profiles, listings or reviews (N12).
- Staff cannot change evidence, accept for a party or act in a case where they are a party.
- Every deadline text includes «Fristene gjelder saksbehandlingen i Laandet. De begrenser ikke rettighetene dere har etter norsk lov.»

## TESTS
1. Integration: open → answer → proposal → counter-proposal → accept → resolved, booking back to `completed`.
2. Integration: cannot accept one's own proposal (service and database); a stranger gets 404; escalation rules; staff view without a grant is refused and with a grant is audited; a staff member who is a party cannot take the case.
3. Integration: N12 — a pending case leaves no trace on the public profile or listing.
4. E2E: contested return → dispute → proposal → counter-proposal → accept → resolved (TEST_STRATEGY journey 4).
