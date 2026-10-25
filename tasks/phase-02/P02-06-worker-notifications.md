# P02-06 — Worker jobs, reminders and notifications

## GOAL
Time-based steps happen on their own. Nobody misses a step because they forgot to check the site.

## CONTEXT
- DATA_MODEL §5–§6 (system transitions). CONDITION_REPORTS §7 deadlines. ARCHITECTURE §4.8.

## INPUT
- The worker from P01-05. The `notifications` and `email_outbox` tables.

## OUTPUT
1. **Jobs** (each idempotent, with a heartbeat, and safe to run at the same time on one database through row locks):

   | Job | What it does |
   |---|---|
   | `booking_request_expiry` | `requested` past `owner_response_due_at` (72 h) → `expired` |
   | `agreement_expiry` | `accepted` past `agreement_due_at` → `expired`; the live contract → `void` |
   | `handover_lapse` | category A: one party confirmed and 24 h have passed since the start → `handed_over`, report `lapsed` |
   | `return_lapse` | `return_pending` with one confirmation for 72 h → `completed`, report `lapsed` |
   | `return_reminder` | reminds the renter at the end of the period and 24 h later; tells the owner when «Ikke tilbakelevert» becomes possible |
   | `giveaway_claim_expiry` | claims not answered for 14 days → `expired` |
   | `message_email_batch` | one email per conversation per 15 minutes for unread messages |
2. **In-app notifications:**
   - `/varsler` lists them, newest first, with a link to the right page;
   - the header shows the unread count;
   - opening the page marks them as read.
3. **Email templates (nb/en)** for: new request, request accepted/declined/expired, agreement ready, booking confirmed, cancelled, handover/return to confirm, return reminder, giveaway selected/confirmed, new message. Every email is a short notice and a link, never message text or addresses.

## CONSTRAINTS
- Jobs never act on a booking whose state changed in the meantime (status-conditional updates).
- Every system transition writes `booking_events` with `actor_id = NULL`.

## TESTS
1. Integration: each job with a fake clock. The right rows move, the others do not, and running the job twice changes nothing more.
2. Integration: a notification is created for exactly the other party.
