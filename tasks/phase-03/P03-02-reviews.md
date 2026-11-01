# P03-02 — Two-sided, double-blind reviews

## GOAL
After a completed rental, owner and renter can review each other honestly, without fear of retaliation.

## CONTEXT
- Master spec §8. D-014 (reviews only for completed rentals, not giveaways). DISPUTE_POLICY §4 (sealed while a case is open). PRIVACY §5 (retention, «Tidligere medlem»).

## INPUT
- Completed bookings. The `reviews` table (migration `0005_trust`; the insert trigger checks booking status and parties; ratings and comment cannot be updated).

## OUTPUT
1. **Write** (`/leieforhold/[id]/vurdering`), for 14 days after `completed_at`:
   - communication, punctuality, item condition, keeping to the agreement (1–5); the renter also rates the accuracy of the listing;
   - an optional comment up to 1 000 characters (plain text);
   - once submitted it cannot be changed.
2. **Double-blind:** a review stays `sealed` until both have written or the 14 days are over. If a dispute on the booking is open, publication waits until it closes or the window ends, whichever is later. Worker job `review_publish`; publication also happens at once when the second review arrives.
3. **Profile:** published reviews newest first, average per criterion with the count, and the number of completed rentals. Nothing invented: no reviews → no stars. An author who deleted the account is shown as «Tidligere medlem».
4. **Report a review** (reason `fake_review` and the others) → moderation queue. Service functions `removeReview` / `restoreReview` for staff (P03-03 wires them into the queue): statement of reasons, a `moderation_actions` row, the author is told and can appeal.
5. Notices: «Du kan nå vurdere …» when the booking completes, and «Vurderingene er publisert».

## CONSTRAINTS
- One review per author per booking (unique), never of oneself, only the two parties (trigger).
- The other party's sealed review is never visible, not even to its subject, before publication.
- No editing, no deletion by the author; only staff removal with reasons.

## TESTS
1. Integration: sealed until both wrote; window lapse publishes; open dispute delays; a stranger cannot write; the database refuses a review of a non-completed booking and any update of ratings.
2. Integration: removal by staff with reasons and appeal; the profile shows only published reviews.
3. E2E: the rental journey ends with both reviews, visible after both have submitted (TEST_STRATEGY journey 1, step 11).
