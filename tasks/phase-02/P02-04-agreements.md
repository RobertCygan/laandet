# P02-04 — Agreement generation, rendering, acceptance and revisions

## GOAL
When the owner accepts a request, both parties get the exact same rental agreement text (A). Each accepts
that exact text, and the booking is confirmed only when both have.

## CONTEXT
- RENTAL_AGREEMENTS §1–§6, §8 (required unit tests). D-021.
- Template `legal/nb/forenklet-leieavtale.md` (+ English informational version), loaded in `legal_document_versions`.

## INPUT
- Booking snapshot (P02-02), current template version from the database.

## OUTPUT
1. `modules/contracts`:
   - `selectContractKind`;
   - `buildTerms`: the typed `ContractTerms` snapshot;
   - `toContractView`: every value pre-formatted (`1 500 kr`, `14.12.2026 kl. 10:00`);
   - `renderContract`: logic-less Mustache, with Markdown escaping of every value and HTML comments and front matter removed;
   - SHA-256 of the rendered text.
2. **Agreement numbers:**
   - `LA-YYYY-NNNNNN` for rentals and `GB-YYYY-NNNNNN` for giveaways;
   - from a database sequence.
3. **Page `/leieforhold/[id]/avtale`:**
   - «Kort fortalt» box and the payment warning;
   - the full text rendered with the safe Markdown renderer;
   - «Jeg godtar avtalen». The form posts the hash it showed, and acceptances are listed under the text.
   - English users also see the informational English rendering with «Den norske teksten gjelder».
4. **Acceptance:**
   - the service checks party, hash and deadline, and the database trigger checks party and hash again;
   - when both have accepted: contract `accepted`, booking `confirmed`, both notified.
5. **Change of terms before handover** (period, handover/return method): new revision. The old revision becomes `superseded`, acceptances start over, and the booking goes back to `accepted`.
6. **Deadline:** an agreement not accepted by both before `agreement_due_at` (min(48 h, start)) expires the booking (worker).

## CONSTRAINTS
- The text is rendered once and stored. It is never re-rendered for display, and a later template change never alters it.
- Exact meeting places never appear in the agreement text.
- The runtime role cannot change a contract's text or terms (column privileges), only `status` and `superseded_at`.

## TESTS
1. Unit: the 7 tests in RENTAL_AGREEMENTS §8, plus «every tag in the template is in the view».
2. Integration:
   - acceptance with a stale hash, by a non-party, or after a revision is rejected;
   - the trigger rejects a forged acceptance inserted directly;
   - the runtime role cannot UPDATE `rendered_text`.
3. e2e: both parties accept in their own browser, and the booking shows «Bekreftet».
