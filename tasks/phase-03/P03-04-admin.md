# P03-04 — Admin panel: categories, localities, feature flags, legal versions, security log, metrics

## GOAL
The owner and moderators can run the pilot from the browser instead of the database.

## CONTEXT
- Master spec §21. AUTH_MODEL §4 (who may do what), §6. SECURITY SEC-50/51 (every admin action audited, with a reason; no bulk export).

## INPUT
- `/admin` with 2FA and fresh sessions (Phase 01). Tables `categories`, `localities`, `feature_flags`, `legal_document_versions`, `audit_events`, `worker_heartbeats`.

## OUTPUT
1. **Categories** (`/admin/kategorier`): moderators change the policy only (allowed / restricted / prohibited); admins also edit labels (nb/en), safety notice, allowed listing types, paid rental allowed (D-028), sort order and active. Turning a category prohibited shows how many published listings it has; they are not hidden automatically.
2. **Localities** (`/admin/steder`, admin): add, rename, deactivate. The slug never changes.
3. **Feature flags** (`/admin/flagg`, admin): switch with a reason, audited (`flag.updated`), `updated_by` set. This is where `rentals_open` is opened.
4. **Legal texts** (`/admin/juridisk`, admin): every version per document and language with hash, draft status, effective date and whether it needs re-acceptance. Read-only: texts are loaded with `npm run legal:load`, and nothing in the UI can mark a text as legally reviewed.
5. **Security log** (`/admin/sikkerhet`, admin): the latest audit events with filters by action; IPs only as hashes.
6. **Operations** (`/admin/tall`, all staff): counts of users, listings, bookings and cases by status, open reports and appeals, outbox state, worker heartbeats (late or failing jobs highlighted), rate-limit hits in the last 7 days.

## CONSTRAINTS
- Every change takes a reason (10–500 characters) and writes `audit_events`.
- No page shows message text, email addresses in bulk, password hashes, tokens or 2FA secrets.
- Staff roles stay in the CLI (D-038).

## TESTS
1. Integration: a moderator can change a category policy but not labels; a moderator is refused flags, localities, legal and the security log; every change is audited.
2. Integration: switching `rentals_open` in the admin service opens requests.
3. E2E smoke with axe on the admin pages for an admin with TOTP.
