# Laandet — Security Requirements

**Status:**
- **Designed (Phase 00).** Each requirement has an ID, the control and how it is verified.
- A requirement is *implemented* only when its verification passes in CI or in the
  documented manual check.

Related documents:
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — why each control exists
- [`AUTH_MODEL.md`](AUTH_MODEL.md) — authentication and authorisation detail

## 1. Requirements

### Transport and headers

| ID | Requirement | Verification |
|---|---|---|
| SEC-01 | HTTPS only in staging and production. HTTP redirects to HTTPS. HSTS `max-age=31536000; includeSubDomains` (preload only after owner decision). | Integration test of Caddy config; manual `curl -I` before release |
| SEC-02 | Security headers on every response: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY`. | Playwright test reads headers |
| SEC-03 | CSP: `default-src 'self'; script-src 'self' 'nonce-{random}' 'strict-dynamic'; style-src 'self' 'nonce-{random}'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' {sentry-eu-ingest}; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; upgrade-insecure-requests`. No third-party scripts except the optional Turnstile (added to CSP only when the flag is on). | Playwright test, plus CSP violation reports logged in staging |

### Authentication and sessions

| ID | Requirement | Verification |
|---|---|---|
| SEC-10 | Authentication only via Better Auth. No custom crypto. Rules as in `AUTH_MODEL.md` §1. | Code review, integration tests |
| SEC-11 | Session cookies `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`. Server-side sessions are revocable. | Integration test inspects `Set-Cookie` |
| SEC-12 | Sessions are revoked on password change/reset, suspension, deletion and "logg ut overalt". The status check runs on every request. | Negative test "deleted/blocked user keeps no session" |
| SEC-13 | Rate limits on sign-in, sign-up, password reset and verification resend (values in `AUTH_MODEL.md`). App-level limits (§2 below) on listings, messages, requests, reports and uploads. | Integration tests hit limits and expect HTTP 429 |
| SEC-14 | Staff accounts require TOTP 2FA and 8-hour sessions, and must re-authenticate for sensitive actions. | Integration test: moderator without 2FA → `/admin` denied |

### Authorisation and data handling

| ID | Requirement | Verification |
|---|---|---|
| SEC-20 | Every Server Action and route handler authorises on the server through `authz.can()` before reading private data or writing. Queries are scoped to the actor. Unknown or foreign ids return 404. | One negative test per denied cell of the authorisation matrix; lint rule forbids database access from `app/` without going through a module service |
| SEC-21 | Users cannot write `role`, `status`, `email_verified`, verification level, review status or contract status through any input. Inputs are parsed with Zod `.strict()` schemas. | Unit tests: extra fields rejected |
| SEC-22 | CSRF: Server Actions rely on Next.js origin checking. Better Auth checks `trustedOrigins`. No state-changing GET routes. | Integration test: POST with a foreign `Origin` is rejected |
| SEC-23 | SQL injection: only Drizzle query builder or parameterised `sql` templates. No string concatenation into SQL. | Lint rule (`no-restricted-syntax` on `sql.raw`); code review |
| SEC-24 | XSS: user content is rendered only as React text. No `dangerouslySetInnerHTML` outside the legal-document renderer, which renders **repository-owned** Markdown through a sanitiser with an allow-list. URLs in user text are not linked. | Lint rule bans `dangerouslySetInnerHTML` except one file; e2e test posts `<script>`/`<img onerror>` payloads and checks nothing runs |
| SEC-25 | Server-side validation of every input: length limits, enums, money as integer øre, dates as ISO with time zone, all checked by Zod and duplicated in database `CHECK`s. | Unit tests per schema |

### File uploads

| ID | Requirement | Verification |
|---|---|---|
| SEC-30 | Uploads limited to 10 MB per file, 8 files per listing, 6 per condition entry, 6 per dispute event. The stream is aborted beyond the limit. | Integration test with oversize file |
| SEC-31 | File type is decided by magic bytes (JPEG, PNG, WebP, HEIC). Client MIME type and extension are ignored. Pixel limit 40 MP. | Tests with renamed `.exe`, SVG, HTML, polyglot JPEG/HTML, decompression bomb |
| SEC-32 | Every image is re-encoded to WebP with sharp and stripped of all metadata (EXIF incl. GPS, XMP, IPTC). | Test uploads a JPEG with GPS EXIF and checks the stored file has none |
| SEC-33 | Storage keys are random UUIDs outside the web root. Delivery via `/media/:key` with an authorisation check, `nosniff`, `Content-Type: image/webp`, and `Cache-Control: private, no-store` for private scopes. | Negative test: user C cannot fetch a condition photo of booking A–B |
| SEC-34 | No document uploads (PDF etc.) in the MVP. ClamAV scanning is a precondition for adding any. | Checklist item in `LEGAL_REVIEW_CHECKLIST.md` / release gate |

### Secrets and environments

| ID | Requirement | Verification |
|---|---|---|
| SEC-40 | No secrets in the repository, images, logs or error pages. `.env.example` holds names only. gitleaks runs in CI on every push. | CI job |
| SEC-41 | Separate secrets, database and database roles per environment. Staging never contains production personal data. | Release checklist |
| SEC-42 | Production errors show a generic localised page with a request id. Stack traces only in server logs. | e2e test triggers an error route in production build |
| SEC-43 | Logs never contain passwords, tokens, email addresses, message bodies, exact addresses or raw IPs. IPs are stored only as HMAC hashes in `audit_events`. | Unit test of logger redaction; code review |

### Audit, admin and data

| ID | Requirement | Verification |
|---|---|---|
| SEC-50 | `audit_events` records all security-relevant events: sign-in success/failure, password reset, 2FA changes, role/status changes, moderation actions, staff views of private data, feature-flag changes, legal version publication, account deletion. The table is append-only by privilege. | Integration tests assert audit rows; schema check (`db/schema-checks.sql`) |
| SEC-51 | Admin interface under `/admin`. Role + 2FA required. Every action takes a reason. No bulk export of personal data. | Integration tests |
| SEC-52 | Database runtime role has least privilege (see `DATA_MODEL.md` §8). Migrations run with a separate role. | Schema checks in CI |
| SEC-53 | Nightly encrypted off-site backups of database and media (restic, EU storage). Retention: 7 daily, 4 weekly, 6 monthly. Monthly restore test into a scratch environment, logged in `docs/runbooks/RESTORE_LOG.md`. | Restore test before pilot launch (Phase 04 gate) |
| SEC-54 | Retention and deletion rules from `PRIVACY.md` are run by the worker. | Integration tests for each retention job |

### Supply chain and server

| ID | Requirement | Verification |
|---|---|---|
| SEC-60 | Dependencies pinned with a lockfile. Dependabot (security updates) enabled. `npm audit --audit-level=high` and OSV-Scanner run in CI. High or critical findings block release unless a documented exception exists. | CI job |
| SEC-61 | Docker images use pinned base image digests, run as a non-root user and use a read-only root filesystem where possible. The only writable volumes are `/data/media` and `/tmp`. | Dockerfile review; `docker inspect` in release checklist |
| SEC-62 | Server hardening: SSH keys only, root login disabled, firewall allows 22/80/443 only, unattended security upgrades, PostgreSQL not exposed publicly, fail2ban on SSH. | Release checklist (manual, documented) |
| SEC-63 | The project owner's GitHub, hosting, domain, email-provider and backup accounts use 2FA. | Owner confirms in release checklist |

## 2. Application rate limits (initial values, tunable in config)

| Action | New account (< 7 days) | Established account |
|---|---|---|
| Publish listing | 3 / day | 10 / day |
| Image uploads | 30 / hour | 60 / hour |
| Start conversation | 5 / day | 20 / day |
| Send message | 60 / hour | 200 / hour |
| Rental requests + giveaway claims | 5 / day | 15 / day |
| Reports | 10 / day | 10 / day |
| Category suggestions | 3 / day | 3 / day |

When a limit is exceeded:
1. The user sees a friendly Norwegian or English message.
2. An `audit_events` row is written (`abuse.rate_limited`).
3. Repeated hits show up in the admin dashboard.

## 3. Release security gate (Phase 04)

The pilot can open only when **all** of these are true:

1. SEC-01 … SEC-63 are verified, or a documented exception has been accepted by the owner.
2. No open high or critical dependency findings.
3. Backup restore test performed and logged.
4. Negative authorisation tests green.
5. Owner account 2FA confirmed.
6. Privacy notice and terms published with real controller details (no `MÅ FYLLES UT` markers).

Before opening the pilot, a short external review (or at minimum an independent AI-assisted `#SECURITY` audit plus manual
OWASP ASVS Level 1 checklist) is recommended.
