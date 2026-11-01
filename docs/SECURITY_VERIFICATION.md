# Laandet — Security Verification (P03-05)

**Status on 25.10.2026, after Phase 03.** One row per requirement in [`SECURITY.md`](SECURITY.md).
A requirement counts as verified only when the named check ran and passed (locally on 25.10.2026 and in
CI), or when the manual check is recorded. Nothing has been deployed yet, so everything that needs the
server, the domain or the owner's accounts is still open.

Legend: ✅ verified by an automated test · 🔎 verified by code review or a lint rule · 🟡 partly verified ·
⏳ needs the server or the owner (Phase 04) · ❌ open

| ID | Status | Evidence |
|---|---|---|
| SEC-01 HTTPS, HSTS | ⏳ | Caddy config validates (`caddy validate`, P01-13). Real TLS and the HTTP→HTTPS redirect need the server and domain. |
| SEC-02 security headers | ✅ | e2e `smoke.spec.ts` «security headers are set on every page». |
| SEC-03 CSP with nonce | ✅ | Same e2e test; N9 tests listen for CSP violations (`watchForInjection`) in every journey. |
| SEC-10 Better Auth only | 🔎 ✅ | No custom crypto in the code; `auth.int.test.ts` (sign-up, enumeration, bot checks). Only the two email links of the auth HTTP API are public (e2e `smoke.spec.ts`, D-041). |
| SEC-11 session cookie | ✅ | e2e `security.spec.ts`: `__Host-laandet.session`, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain. **Fixed in P03-05:** the cookie was named `__Secure-__Host-…` before (Better Auth added a prefix). |
| SEC-12 session revocation | ✅ | Suspension deletes every session (`moderation-measures.int.test.ts`); status checked on every request — a deleted account is signed out at the next page (e2e `security.spec.ts`); password change and reset revoke other sessions (Better Auth setting, `auth/service.ts`). |
| SEC-13 rate limits | ✅ | Listings (3/day new accounts), messages (61st in an hour), reports (11th in a day), case steps (61st in a day) refused in integration tests. Every app-level hit writes `abuse.rate_limited` (**added in P03-05**, asserted in `listings.int.test.ts` and `disputes.int.test.ts`); the operations page counts them. **Review fixes:** limits for case and booking steps (M4); the new-conversation limit is checked before the transaction, so its audit row is kept (L6); the per-email key is an HMAC (`security.int.test.ts`). |
| SEC-14 staff 2FA, 8 h | ✅ | `moderation.int.test.ts` (no 2FA → refused, stale session → refused); policy unit tests; e2e journeys set up real TOTP. |
| SEC-20 server-side authorisation, 404 | ✅ 🔎 | 79 policy unit tests (every Phase 01–03 action, including `evidence.upload` and accounts waiting for erasure, review L5); negative integration tests per area (N1, N2, N13, N15, bookings, claims, cases, reviews, export); lint rule forbids `@/db/client` in `app/` and `ui/`. |
| SEC-21 no privileged fields from input | ✅ | `security.int.test.ts`: profile, request, change of terms, review, case and measure inputs drop `role`, `status`, money terms and similar. Note: the schemas strip unknown keys rather than reject them (`.strict()`); the effect for privileged fields is the same, and the database guards contracts, reviews, proposals and booking terms with column privileges and triggers. |
| SEC-22 CSRF | ✅ | e2e `security.spec.ts`: a Server Action posted with a foreign `Origin` is refused, the same action works from the site. No state-changing GET routes: the data export (counted and audited) is a same-origin POST, GET gives 405 and a foreign `Origin` 403 (review L4, same spec). |
| SEC-23 SQL injection | 🔎 | Drizzle query builder and `sql` templates only; lint bans `sql.raw` (used only in a test helper). |
| SEC-24 XSS | ✅ 🔎 | Lint bans `dangerouslySetInnerHTML`; legal Markdown renderer skips HTML (unit test with a malicious fixture); e2e N9 for names, listings and messages; cases, reviews and agreement texts are rendered as text or through the same safe Markdown renderer. |
| SEC-25 validation | ✅ | Zod schemas plus database `CHECK`s (lengths, enums, øre as integers); unit and integration tests per area. |
| SEC-30 upload limits | 🟡 | 10 MB per file (e2e near-limit upload; the Server Action body limit is 11 MB), 8 images per listing, **6 per condition entry and per case statement (fixed in P03-05; was 8)**. The request body is not streamed and cut at exactly 10 MB; Next.js refuses bodies above the configured limit. |
| SEC-31 magic bytes, pixel limit | ✅ | `media.int.test.ts` (HTML disguised as JPEG refused); pixel limit in `media/process.ts`. HEIC is not decoded (D-039). |
| SEC-32 metadata stripped | ✅ | `media.int.test.ts` (EXIF/GPS gone after re-encoding). |
| SEC-33 private media | ✅ | N13 condition photos (`condition.int.test.ts`, e2e rental journey); case photos and staff access only with an active grant, each view audited (`disputes.int.test.ts`). |
| SEC-34 no documents | 🔎 | Only image scopes exist; every upload is decoded and re-encoded as WebP. |
| SEC-40 no secrets | ✅ | gitleaks in CI on every push; `.env.example` holds names only. |
| SEC-41 separate environments | ⏳ | Deploy files separate staging and production; checked at release. |
| SEC-42 generic error page | 🟡 | **Added in P03-05:** localized error page and a last-resort global page that show only the reference code (digest). Not covered by an automated test: the production build has no route that fails on purpose. |
| SEC-43 nothing personal in logs | ✅ | **Added in P03-05:** `safeError` removes query parameters and email addresses from logged errors and from errors stored in `worker_heartbeats` (unit test); a failed message write never carries the text (`messaging.int.test.ts`); IPs only as HMAC hashes. |
| SEC-50 audit log | ✅ | Integration tests assert audit rows for moderation, appeals, flags, category and transparency changes, case grants and staff views, rate-limit hits and data exports; append-only (`privileges.int.test.ts`). The audit purge never goes below 24 months, whatever the caller passes (review M1, `privacy.int.test.ts`). |
| SEC-51 admin interface | ✅ | Role + 2FA + fresh session for `/admin`; every admin change needs a reason (`admin.int.test.ts`); no bulk export of personal data. |
| SEC-52 least privilege | ✅ | `privileges.int.test.ts`; append-only and column privileges for contracts, acceptances, condition evidence, case events, grants, reviews and proposals (integration tests per area). Functions with elevated rights use `search_path = public, pg_temp` (review L7, `0010`). |
| SEC-53 backups and restore | ⏳ | restic backup and scripted restore tested locally with Docker (P01-13). The first real restore test is a Phase 04 gate. |
| SEC-54 retention jobs | ✅ | `privacy.int.test.ts`: each job deletes what PRIVACY §5 says and nothing newer; account erasure waits for open bookings. **Review fixes:** the app role cannot backdate a row into an early purge (database-stamped `last_changed_at`, M1 test); inactivity is measured by `last_seen_at`, so staff and members with rolling sessions are not warned or erased while active (H1 test). |
| SEC-60 dependencies | ✅ | Lockfile, Dependabot, `npm audit --omit=dev --audit-level=high` and **OSV-Scanner** (added in P04-02) in CI. OSV fails the job on CVSS ≥ 7.0 (`scripts/osv-gate.mjs`). First run, 25.10.2026: 758 packages, one moderate finding (esbuild 0.18.20 via drizzle-kit, development only), none high or critical. |
| SEC-61 container | 🔎 | Pinned base image digest, non-root, read-only root filesystem (Dockerfile, checked with Docker in P01-13). |
| SEC-62 server hardening | ⏳ | Release checklist; needs the server. |
| SEC-63 owner 2FA | ⏳ | The owner confirms at release. |

## Negative tests N1–N15 (TEST_STRATEGY §4)

| # | Where it runs |
|---|---|
| N1 | policy unit test, `listings.int.test.ts`, e2e `abuse.spec.ts` |
| N2 | `messaging.int.test.ts`, e2e `messaging.spec.ts` |
| N3 | policy unit test, `listings.int.test.ts`, `media.int.test.ts` |
| N4 | `rentals.int.test.ts` (service and database `CHECK`), unit tests |
| N5 | `listings.int.test.ts` (prohibited, restricted ack, free-only categories) |
| N6 | `security.int.test.ts`: the database refuses any change to deposit, price, value or parties of a booking (trigger **added in P03-05**); no endpoint moves deposits |
| N7 | `rentals.int.test.ts`, `giveaways.int.test.ts` (acceptance trigger) |
| N8 | `media.int.test.ts` |
| N9 | e2e `abuse.spec.ts`, `messaging.spec.ts`, every journey listens for dialogs and CSP violations |
| N10 | `moderation-measures.int.test.ts` (suspension), e2e `security.spec.ts` (deleted account) |
| N11 | e2e `journey.spec.ts`, `smoke.spec.ts` |
| N12 | `disputes.int.test.ts`, e2e `disputes.spec.ts` |
| N13 | `condition.int.test.ts`, `disputes.int.test.ts`, e2e `rentals.spec.ts` |
| N14 | `moderation.int.test.ts`, policy unit test |
| N15 | `moderation-measures.int.test.ts` |

## Independent review

A separate read-only review of the Phase 02–03 code was done by an independent agent (not the implementer).
It found 1 high, 4 medium and 7 low issues, plus an unkeyed email hash. Each was checked against the code and
fixed with a test. One race test (L2) was also run without the fix to confirm that it fails. The table with
each finding, fix and test is in the Phase 03 entry of [`CHANGELOG.md`](CHANGELOG.md).
