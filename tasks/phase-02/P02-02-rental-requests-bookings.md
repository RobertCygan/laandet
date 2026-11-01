# P02-02 — Rental requests and the booking state machine

## GOAL
A member can ask to rent a «Leies ut» listing for a period. The owner accepts or declines. Accepted periods
can never overlap. Every step is recorded and visible to both parties.

## CONTEXT
- DATA_MODEL §5 (state machine). D-011 (category B blocked), D-013 (a request is a booking), D-028 (free lending only in some categories).
- AUTH_MODEL §4 rows «Send rental request», «Accept / decline request».
- Feature flag `rentals_open` (off by default until the legal gate is met).

## INPUT
- Listings from P01-08 (price unit, declared value, deposit, handover options).
- Conversations from P02-01.

## OUTPUT
1. **Migration `0003_rentals`:**
   - all Phase 02 tables from `db/schema-draft.sql`: conversations, participants, messages, bookings, booking_events, giveaway_claims, contracts, contract_acceptances, condition reports, entries, photos, confirmations, and a minimal `disputes` table;
   - the exclusion constraint against overlapping active bookings;
   - the `mvp_category_a_only` check;
   - the contract acceptance trigger;
   - append-only privileges (DATA_MODEL §8).
2. **Pure state machine** `modules/rentals/state.ts`: `transition(booking, event, actor, now)` returns the next status or a typed error. It is unit-tested for every status × event × role.
3. **Price calculation** (pure): units for hour/day/weekend/week from the period, total = units × price. Shown before the request is sent.
4. **Request form** on the listing page (when `rentals_open` is on):
   - start and end (date + time, Europe/Oslo);
   - handover and return method from the listing's options;
   - optional message.

   It shows price, deposit, the payment warning and that the agreement comes after acceptance.
5. **Services:**
   - `requestBooking`, `acceptBooking` (creates agreement revision 1, P02-04), `declineBooking`, `withdrawBooking`, `cancelBooking` (before handover, reason required);
   - each step checks the policy and the guards, writes a `booking_events` row, adds a system message in the thread and notifies the other party.
6. **Pages:**
   - `/leieforhold`: «Mine leieforhold», as renter and as owner, grouped as active, requests and finished;
   - `/leieforhold/[id]`: status, period, terms snapshot, the private meeting place (parties only), timeline, and the next actions for this party.
7. **Expiry:** requests expire after 72 h without an answer (worker, P02-06).

## CONSTRAINTS
- The booking stores a snapshot of the terms, so later listing edits never change it.
- Category B and paid rental in free-only categories are refused by the service and by the database.
- Owner and renter must be different, active and not blocking each other. The renter must have a verified email.
- Request limits: 5 per day for new accounts, 15 for established ones.

## TESTS
1. Unit: every transition in DATA_MODEL §5, and every forbidden transition. Price and unit calculation, including the boundaries.
2. Integration:
   - two overlapping accepts on the same listing: the second fails (database constraint);
   - a non-party gets 404 on booking pages and actions;
   - the owner cannot request their own listing;
   - with `rentals_open` off, requests are refused.
3. Integration: N4. A booking with declared value > 5 000 kr cannot be stored (service + `CHECK`).
4. e2e: request → accept → (agreement, P02-04) at a phone viewport.
