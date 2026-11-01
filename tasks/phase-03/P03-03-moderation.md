# P03-03 — Moderation: full queue, user measures, appeals, support access grants

## GOAL
Staff can handle every kind of report fairly and safely, and can only see private material when there is a
documented reason.

## CONTEXT
- Master spec §21. AUTH_MODEL §3–6. DSA-style notice and action: statement of reasons and appeal.

## INPUT
- Phase 01 moderation (reports, hide listing, appeals). Phase 02 message reports. The `support_access_grants` table.

## OUTPUT
1. **Queue** for every target type: listing, user, message, review, dispute. Filters: automatic, type.
2. **Actions** with a reason code and a statement of reasons (10–4 000 characters), each a `moderation_actions` row, audited, the affected user told in the app and by email, and appealable:
   - listing: hide / restore;
   - user: warn, restrict (optionally with an end date), suspend (sessions revoked, listings hidden), reinstate;
   - review: remove / restore (P03-02 service);
   - dismiss a report with a note.
3. **Restrictions work everywhere:** a restricted user cannot publish, request, claim or start conversations; a suspended user can only sign in to read the reason, appeal and download their data.
4. **Support access grants:** reported messages are shown to staff only through the report (attached messages, audited `staff.view_report_messages`). Disputes use P03-01 grants. N15: staff cannot read a conversation without a report or a grant.
5. **Appeals** for every action type, decided by another staff member when one exists (otherwise «behandlet av samme person»). Reversal undoes the action.
6. **Repeated reports** by the same user against the same person are flagged in the queue.

## CONSTRAINTS
- Staff never handle a case they are part of (listing, review or user about themselves).
- Measures are a safety tool, not a penalty for losing an argument.

## TESTS
1. Integration: restrict → cannot publish/request; suspend → session gone; reinstate; appeal reverses.
2. Integration: N15; staff without 2FA are refused (N14 stays green); a moderator cannot act on their own profile or review.
3. E2E: report listing → hide with reasons → appeal → reversed by a second staff member (journey 5, kept green).
