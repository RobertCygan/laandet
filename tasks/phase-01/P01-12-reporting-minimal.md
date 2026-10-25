# P01-12 — Reporting and minimal moderation

## GOAL
From the first public listing, anyone signed in can report problematic listings or profiles. A moderator can act on
a report with a written statement of reasons, and the affected user can appeal.

## CONTEXT
- Master spec §21.
- Notice-and-action design (L-02, DSA art. 16–17 as good practice).
- Authorisation and staff 2FA: P01-06.
- Phase 03 (P03-03) extends this to messages, reviews, account restrictions and a full appeals UI.

## INPUT
- Tables `reports`, `moderation_actions`, `appeals` (from the reference schema), `notifications`, `email_outbox`, `audit_events`.

## OUTPUT
1. «Rapporter» buttons on listing detail and public profile. The dialog asks for:
   - a reason (from `reports.reason`)
   - optional details (≤ 2 000 characters)
   - an honesty confirmation («Jeg rapporterer i god tro»)
2. Visitors without an account see the contact email for reports (L-01).
3. Admin queue `/admin/rapporter` (moderator or admin with 2FA): open reports, newest first, plus a filter for automatic keyword reports.
4. Moderator actions on a listing:
   - **«Skjul annonse»**
     - The statement of reasons is required (template fields: what rule, what content, what the user can do).
     - The listing status becomes `removed`.
     - The owner is notified in-app and by email.
   - **«Avvis rapport»**, with a note.
5. The owner sees on the listing: hidden, the reason, and an «Klag på avgjørelsen» form.
   - The form creates an `appeals` row.
   - The appeal is decided by a different staff member, or marked «behandlet av samme person» if only one exists (`AUTH_MODEL.md` §4).
6. Every action is audited with the actor, the reason and a link to the report.

## CONSTRAINTS
- Moderators do not see private messages in Phase 01; messaging comes in Phase 02.
- The reporter's identity is not revealed to the reported user.
- Reports are rate-limited (10 per day).
- Statements of reasons are factual and never call anyone a criminal.

## TESTS (acceptance criteria)
1. **Integration:** a report requires sign-in. The 11th report in a day → 429.
2. **Integration:** hiding a listing writes `moderation_actions` (with the statement), `audit_events` and a notification, and the listing disappears from explore.
3. **Integration:** a non-staff user and a moderator without 2FA both get 403 or a redirect from `/admin/rapporter` and its actions.
4. **Integration:** an appeal by the owner is stored. A staff member who hid the listing cannot decide the appeal if another staff member exists.
5. **e2e:** report a listing → moderator hides it → owner sees the reason and submits an appeal.
