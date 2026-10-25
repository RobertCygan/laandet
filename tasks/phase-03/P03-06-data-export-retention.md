# P03-06 — Data export, retention jobs and account erasure

## GOAL
People can download their data, and Laandet deletes what it no longer needs, on time and automatically.

## CONTEXT
- `docs/PRIVACY.md` §5 (retention schedule), §6 (account deletion), §8 (rights). SEC-54.

## INPUT
- All tables. The account deletion request from Phase 01 (`deletion_pending`).

## OUTPUT
1. **«Last ned mine data»** on `/konto`: a JSON file with profile, listings, own messages, bookings, agreements (stored text), own condition entries, reviews written and published reviews received, reports filed, disputes (parties-visible events), legal acceptances and notifications. Audited (`user.data_export`), at most 5 per day, also available to suspended accounts. Never another person's email, never staff-only notes, never sealed reviews about the user.
2. **Retention jobs** (worker, each idempotent, each with an integration test that it deletes exactly what PRIVACY §5 says and nothing else):
   - deleted/archived listings and their images after 30 days;
   - conversations without a booking 12 months after the last message;
   - notifications after 12 months; outbox rows 30 days after sending;
   - bookings with agreements, events, condition reports and photos 3 years after the booking ended (and no open case); giveaway claims 3 years after transfer; disputes 3 years after closure;
   - reports, moderation actions and appeals 2 years after closure; category suggestions after 12 months.
   Append-only tables are purged through `SECURITY DEFINER` functions owned by the migration role, like `purge_expired_audit_events`.
3. **Account erasure job:** `deletion_pending` accounts with nothing blocking (booking under way, selected claim, open case) are erased within 30 days of the request, exactly as PRIVACY §6: deleted, replaced («Slettet bruker», `deleted+<uuid>@invalid`), kept pseudonymised. A confirmation email goes out before the address is removed.
4. **Inactive accounts:** a warning email after 24 months without sign-in, erasure 60 days later.

## CONSTRAINTS
- Nothing is deleted that a party still needs for an open case or a booking under way.
- Jobs are safe to run twice and at the same time.

## TESTS
1. Integration: export content and exclusions; rate limit; a stranger cannot fetch another person's export.
2. Integration: each retention job with a fake clock; erasure waits for an open booking and then runs; the erased user can no longer sign in, and the other party still sees the agreement with «Slettet bruker».
