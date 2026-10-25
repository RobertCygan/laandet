# P02-01 — Conversations and messages

## GOAL
Two users can talk about a listing (and later about the rental or giveaway that grows out of it), safely and
in plain text. People can block each other and report a message.

## CONTEXT
- Master spec: messaging. ARCHITECTURE §4.7 (plain text, polling every 20 s, email batching every 15 min).
- AUTH_MODEL §4 rows «Start conversation», «Read conversation»; blocking notes.
- D-013, D-020 (replies to «Ønskes leid» can point to the replier's own «Leies ut» listing).
- SECURITY §2 rate limits: start conversation 5/20 per day, send message 60/200 per hour.

## INPUT
- Tables `conversations`, `conversation_participants`, `messages`, `user_blocks` (created in P02-02's migration).
- Listing detail page from P01-10.

## OUTPUT
1. **One conversation per (listing, interested user)**, created on the first message, request or claim. The rental request (P02-02) and the giveaway claim (P02-03) for that pair live in the same thread.
2. **Pages:**
   - `/meldinger`: inbox with the newest activity first, listing title, the other party's display name and an unread marker.
   - `/meldinger/[id]`: the thread. It polls for new messages every 20 s while open. Booking or claim status and links are shown above the messages.
3. **«Send melding»** on a listing page for signed-in members (not on your own listing, not on demo listings, not if either user has blocked the other).
4. **Reply to «Ønskes leid»:** the reply form can attach one of the replier's own published «Leies ut» listings. It shows as a card linking to that listing. The rental itself always happens on that listing (D-020).
5. **Messages:**
   - plain text, 1–4 000 characters, rendered as React text (no Markdown, no auto-linking);
   - system messages for state changes (request sent, accepted, …);
   - a gentle warning when a message contains a payment link or asks for a BankID code (heuristic, Should).
6. **Block and report:**
   - «Blokker» on the thread hides the thread from the blocker and stops new conversations, messages, requests and claims in both directions. Ongoing bookings stay accessible, so both can finish them.
   - «Rapporter melding» creates a `reports` row with `target_type = 'message'`.
7. **Email:** at most one notice per conversation per 15 minutes, with a link only and no message text. Users who turned email notifications off get none.

## CONSTRAINTS
- Only the two participants can read a thread. Anyone else gets 404, including staff (P03 adds audited grants).
- Message text never goes into logs, emails or audit metadata.
- Restricted accounts cannot start new conversations but can reply in existing ones.

## TESTS
1. Integration: N2. User C cannot read A–B's conversation or its messages (404).
2. Integration: blocking stops new messages and requests in both directions. An ongoing booking thread is still readable.
3. Integration: the message rate limit returns `rate_limited`. Starting a conversation on your own listing is refused.
4. Integration: the email batching job sends at most one email per conversation in 15 minutes, and never the body.
5. e2e: N2 in the browser. `<script>` in a message is shown as text, with no dialog and no CSP violation (N9).
