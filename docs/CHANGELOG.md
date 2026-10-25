# Changelog

All notable changes to Laandet. Dates are DD.MM.YYYY.

## [Phase 01] — 25.10.2026 (implemented and tested; CI green; not deployed)

The application lives in `app/` (Next.js 16, PostgreSQL, Drizzle, Better Auth). Setup and commands: `app/README.md`.

### Added
- **Accounts (P01-05, P01-07):**
  - sign-up with three required confirmations (18+, private use, terms + privacy), honeypot and a 3-second minimum fill time;
  - email verification;
  - sign-in with generic errors;
  - password reset, change password (signs out other devices) and change email (re-authentication, new address verified first, old address told);
  - sign out everywhere;
  - account deletion request (deactivates now, hides listings, revokes sessions, sends a confirmation). The erasure job itself is P03-06.
  - Public profile without email and with no invented statistics («Ny på Laandet»).
- **Staff security (AUTH_MODEL §2):**
  - roles only via the audited `grant-role` CLI;
  - staff must set up TOTP 2FA before `/admin` opens;
  - staff sessions expire for admin use after 8 hours;
  - staff cannot moderate their own listings.
- **Authorisation and audit (P01-06):**
  - one policy (`can()`); other people's objects give 404;
  - append-only audit log with HMAC-hashed IPs;
  - a least-privilege database role.
- **Listings (P01-08):**
  - five-step wizard for «Leies ut», «Ønskes leid» and «Gis bort». Drafts can be saved at any step and stay in the wizard.
  - Server-side publish rules:
    - category B (> 5 000 kr) blocked while `high_value_preview` is off;
    - free lending only in tilhengere/sykler/padling (D-028);
    - deposit ≤ value;
    - restricted categories need an acknowledgement;
    - no contact details in titles.
  - Keyword screening creates an automatic report for moderators and warns the owner.
  - `/mine-annonser` with pause/resume/archive/delete, plus saved listings.
  - Rate limits: 3 new listings/day for new accounts, 10 for established ones.
- **Images (P01-09):**
  - content sniffing;
  - pixel limit;
  - re-encoding to WebP (1 600 px + 480 px thumbnails) with all metadata (EXIF/GPS) removed;
  - random storage keys outside the web root;
  - an authorised media route (drafts only for the owner).
- **Explore and detail (P01-10):**
  - search (Norwegian full text + trigram);
  - type tabs and filters (category, locality, price, handover, availability, sort) in shareable URLs;
  - category tiles; `/gis-bort` shortcut.
  - The detail page shows «Privatperson», the deposit or «Ingen depositum», a disabled «Send forespørsel» («Forespørsler åpner snart») and the safety notice for restricted categories. The declared value is never shown publicly.
- **Content and legal pages (P01-11):**
  - Om, Slik fungerer det, Trygghet (only facts that are true now, plus «Planlagt»), Kontakt (operator details from configuration only), Åpenhet (empty until there are checked numbers), Støtt Laandet (no outbound link until a real campaign is configured).
  - All legal drafts are rendered from the database with version and the draft banner. The English pages say the Norwegian text prevails.
  - The legal loader stores SHA-256 hashes and never loads placeholders in production.
  - Users must re-accept after a material change to the terms or privacy notice.
- **Reporting and moderation (P01-12):**
  - report listings and profiles: signed-in users use the form; visitors without an account see the contact email or the contact page. Reports are limited to 10 per day.
  - The admin queue (newest first, filter for automatic reports) lets staff hide a listing with a statement of reasons. The owner is notified in the app and by email.
  - The owner sees the reasons and can appeal. Another staff member decides, or it is recorded as «samme person» when only one exists.
- **Worker:** email outbox (SMTP, or the log in development), retries, clean-up of rate limits, auth tokens and orphaned media, audit retention.
- **Security baseline:**
  - CSP with a per-request nonce and `strict-dynamic`, `frame-ancestors 'none'`, nosniff, a strict referrer policy;
  - Server Actions only (built-in origin check);
  - ESLint rules banning `dangerouslySetInnerHTML`, `sql.raw` and direct database imports in pages;
  - same-site-only redirect targets after sign-in.
- **CI** (`.github/workflows/laandet-ci.yml`): lint/format/types, unit, integration (PostgreSQL 17), build + Playwright, gitleaks and `npm audit`. Dependabot is configured.
- **Deployment files and runbooks (P01-13):**
  - Dockerfile, Compose for production/staging/edge, Caddy, a deploy script with rollback, a deploy workflow (off until enabled), restic backups with a systemd timer, a restore script, and runbooks.
  - Verified locally with Docker only (D-040). **Nothing has been deployed, bought or registered.**
- **Independent security review** (separate read-only review of the code). All 7 findings were fixed, and the fixes are covered by tests:
  - **Medium:** the Better Auth HTTP endpoints let callers skip app checks, which allowed an email change without a password and a sign-up that locked an address. Now only the email links are served (D-041), and an interrupted sign-up is recovered.
  - **Low/medium:** a race let an owner's save undo a moderator's removal. Status writes are now conditional.
  - **Low:** staff could handle reports they made or that concerned themselves; restricted accounts could publish drafts or resume listings; images of hidden listings were cached for 24 hours (now 5 minutes, with an owner-status check); raw IPs were stored in sessions (now hashed).
- Also found during deployment testing and fixed: requests pass through `proxy.ts`, which cut uploads near 10 MB. Fixed with `proxyClientMaxBodySize`.
- Decisions D-030…D-041 (implementation level) in `DECISIONS.md`.

### Tested (run locally on 25.10.2026, PostgreSQL 16, Chromium from Playwright 1.63)
- **Unit (Vitest): 87 passed**
  - money/date formats;
  - authorisation policy (39 cases incl. N14);
  - listing rules incl. category B, deposit and storage checks;
  - nb/en message parity and placeholders;
  - legal link rewriting and support-page blocks;
  - the legal Markdown renderer against a malicious fixture (script, `onerror`, `javascript:`, comments);
  - redirect-path safety.
- **Integration (Vitest against `laandet_test`): 25 passed.** These also pass on a freshly created empty database.
  - runtime-role privileges (audit log and acceptances append-only, legal texts read-only);
  - sign-up (consent records, no account enumeration, bot checks);
  - listing rules, ownership (N1), unverified accounts (N3), category B (N4), free-only categories (N5);
  - draft/paused visibility, publish rate limit, keyword reports;
  - report rate limit, staff 2FA and session freshness (N14), hide → audit + notification + email + gone from explore, appeals by a different staff member;
  - legal loader idempotency and production refusal, re-acceptance;
  - EXIF/GPS removal and fake-image rejection (N8).
- **End-to-end (Playwright, production build): 31 passed** (mobile; journey and smoke also on desktop)
  - register → verify → publish with a photo → found in explore, never visiting the support page (N11);
  - N1 (another user gets 404 on the edit page);
  - N9 (HTML/script in display name, title and description shown as text; no dialogs, no CSP violations);
  - full moderation journey with real TOTP;
  - every footer/content page 200 in nb and en; draft and translation banners;
  - language switch with Norwegian number formats;
  - security headers;
  - axe (WCAG 2.1 AA): no serious or critical violations on 7 pages;
  - a photo 200 bytes under the 10 MB limit uploads whole. This was confirmed to fail without the proxy body-size setting.
  - the auth API answers only the two email links.
- **Manual checks in the browser:** layouts on 390 px and 1 280 px for the main pages, the worker sending a queued email to the log, and the `grant-role` CLI.

### Not done / known gaps
- **No deployment.** Staging and production need a server and a domain bought by the owner (`docs/runbooks/BILLING.md`).
- **Legal texts are drafts.** They are not legally reviewed. Fields marked «MÅ FYLLES UT FØR LANSERING» block loading in production.
- CI (`laandet-ci`) was green on 25.10.2026 for all five jobs: lint/format/types, unit, integration on PostgreSQL 17, build + Playwright, and secrets/audit.
- Differences from the task files:
  - offset instead of keyset pagination, and no `EXPLAIN` fixture (D-032);
  - the keyword warning appears after saving, not while typing;
  - profile reports can only be dismissed (user restrictions are a manual admin step);
  - the account erasure job is P03-06.
- Not tested here:
  - HEIC: the prebuilt `sharp` cannot decode HEIC (checked: only AVIF in its HEIF support). The file picker therefore asks for JPEG/PNG/WebP, so iPhones convert photos to JPEG; a `.heic` file picked on a computer gets a clear message;
  - real SMTP delivery;
  - Safari/WebKit.

## [Phase 00] — 25.10.2026

### Added
- **Inventory** of the existing repository and prototype (`CURRENT_STATE_ASSESSMENT.md`):
  - every prototype route was rendered and its text captured;
  - design tokens, 19 images, the favicon and demo content were extracted to `design/prototype/`.
- **Master specification** stored verbatim, with an amendments table (`MASTER_SPECIFICATION.md`).
- **Decision log** D-001…D-029 (`DECISIONS.md`), all *Proposed*. Highlights:
  - two UI languages (nb + en);
  - Next.js + Drizzle + Better Auth + PostgreSQL on one EU VPS;
  - no money flows;
  - category B (> 5 000 kr) blocked;
  - paid rental of means of transport paused pending the DPI question.
- **Architecture** (`ARCHITECTURE.md`), **data model** with state machines and privileges (`DATA_MODEL.md`),
  **authentication/authorisation model** (`AUTH_MODEL.md`).
- **Reference database schema** `db/schema-draft.sql`, with **executable checks** `db/schema-checks.sql`.
  Applied to PostgreSQL 16 on 25.10.2026: **23/23 checks passed**.
- **Security requirements** (`SECURITY.md`, SEC-01…63) and **threat model** (`THREAT_MODEL.md`, 29 threats).
- **System designs:** condition reports, rental agreements, dispute workflow, prohibited/restricted items,
  privacy and retention, voluntary support and transparency page.
- **Legal drafts in Norwegian Bokmål** (`legal/nb/`), all marked *UTKAST – ikke juridisk gjennomgått*:
  - brukervilkår
  - personvernerklæring
  - informasjonskapsler
  - forenklet leieavtale
  - utvidet leieavtale
  - gis bort – overleveringsbekreftelse
  - retningslinjer for tvister
  - forbudte og begrensede gjenstander
  - retningslinjer for trygg utleie
  - Støtt Laandet page text
- **English informational translations** of all legal drafts (`legal/en/`).
- **Legal review checklist** based on research on 25.10.2026, separating verified facts, assumptions and questions (`LEGAL_REVIEW_CHECKLIST.md`).
- **Cost model** for 100/500/2 000/10 000 users, including the 2026 Hetzner price changes (`OPERATING_COSTS.md`).
- **Test strategy** (`TEST_STRATEGY.md`) and **roadmap** to 14.12.2026 with release gates and the owner decisions needed (`DEVELOPMENT_ROADMAP.md`).
- **Phase 01 task definitions** P01-01…P01-13 (`tasks/`).

### Not changed
- `Laanndet.html`, `www/` and all other existing files are untouched.
