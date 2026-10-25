# Changelog

All notable changes to Laandet. Dates are DD.MM.YYYY.

## [Phase 03] — 25.10.2026 (waiting for the owner's approval; not deployed)

### Added
- **Cases between the parties (P03-01, DISPUTE_POLICY):**
  - «Meld fra om et problem» on a booking, with the safety screen first. A contested return opens a case by itself;
  - `/saker/[id]` for the two parties only: statements, up to 6 photos per entry, a message from the booking conversation attached as a reference, proposals and counter-proposals with «Godta»/«Avslå», withdrawal by the person who opened it;
  - a case opened after the recommended deadline is accepted and marked as late;
  - «Be Laandet om hjelp» once the other party has answered or the deadline has passed (at once for urgent categories);
  - support queue at `/admin/saker` with metadata only. A staff member sees the case text and photos only after «Ta saken» with a reason: a 30-day grant, and every view is audited;
  - staff can ask for documentation, give a three-part, non-binding recommendation («dokumentert», «uenige om», «anbefaling») that both parties accept or reject, close a case with neutral information about other options, and reopen an escalated case within 30 days;
  - Laandet never decides who is right and never moves money. When a case closes, a disputed booking returns to completed and both parties are invited to review it;
  - the case file, grants and proposal terms are append-only for the app role (column privileges and triggers).
- **Reviews (P03-02):**
  - two-sided and double-blind for completed rentals, one per party, within 14 days of completion. The window restarts when a later case closes;
  - sealed until both have written or the window ends, and held while a case is open; published at once or by the `review_publish` job;
  - the public profile shows published reviews, averages and a real count of completed rentals. A deleted author is shown as «Tidligere medlem»;
  - reviews can be reported; staff remove and restore them with a statement of reasons.
- **Moderation (P03-03):**
  - account measures: warn, restrict (optionally until a date, ended by the `restriction_expiry` job), suspend (all sessions revoked) and reinstate, each with a statement of reasons, an email and an appeal;
  - the report queue covers listings, profiles, messages and reviews, flags repeated reports and audits every reported message shown (N15);
  - staff never act on themselves or in a case they are part of; only admins act on staff accounts;
  - every moderation action can be appealed. A reversed appeal undoes the measure. Moderation notices appear on «Varsler».
- **Admin panel (P03-04):** categories (moderators: policy only), localities, feature flags (switching needs a reason; `rentals_open` can now be opened here), legal versions (read-only; nothing can mark a text as reviewed), the security log (admin, read-only, IP hashes only) and operations figures for all staff. Every change takes a reason and is audited.
- **Your data (P03-06):**
  - «Last ned mine data (JSON)» on `/konto`: the person's own data without other people's email, staff-only notes or sealed reviews about them. Audited, five a day;
  - retention jobs per PRIVACY §5 (listings, messages, notifications, outbox, category suggestions, orphaned photos, the audit log after 24 months), and append-only records through fixed-period database functions;
  - account erasure per PRIVACY §6 once no booking, claim or case is under way; inactive accounts get a warning after 24 months and are erased 60 days later.
- **Transparency (P03-07):** admins enter real monthly figures; `/apenhet` shows only those, plus a separately labelled estimate section from `OPERATING_COSTS.md`. **No real figures are entered yet**, so the page shows its empty state.
- **Security pass (P03-05):** `docs/SECURITY_VERIFICATION.md` (every SEC requirement with its evidence) and `docs/ASVS_L1.md` (OWASP ASVS 4.0.3 Level 1 self-assessment). Fixed while checking:
  - **SEC-11:** the session cookie was named `__Secure-__Host-laandet.session`, so browsers applied only the weaker `__Secure-` rules. It is now `__Host-laandet.session`;
  - **SEC-30:** condition entries allowed 8 photos instead of 6;
  - **SEC-13:** rate-limit hits were not audited (now `abuse.rate_limited` with the user and the kind of limit, never an IP);
  - **SEC-43:** errors stored in worker heartbeats could contain email addresses or query strings (now redacted);
  - **SEC-42:** localized error pages that show only a reference code;
  - **N6:** a database trigger keeps the parties and money terms of a booking fixed after the request.

### Independent security review (P03-05)
A separate agent read the Phase 02–03 code without the implementer's notes. Every finding was checked against the code, then fixed with a test:

| # | Finding | Fix | Test |
|---|---|---|---|
| H1 | The inactivity job read sign-ins from the audit log. Staff signing in with 2FA and members with rolling sessions wrote none, so active accounts (staff included) would have been warned and erased. | `user_profiles.last_seen_at`, stored by every signed-in request at most once a day; the job uses it. The 2FA step now also records the sign-in. | `privacy.int` |
| M1 | The retention periods were fixed, but measured from dates the app writes itself; a compromised app role could backdate a row and purge its evidence. The audit purge took any period. | The database stamps `last_changed_at` on every change by the app role, and each purge also waits for it; the audit purge never goes below 24 months (`0009`, `0010`). | `privacy.int` (M1) |
| M2 | Staff could reopen a case the parties had settled without asking Laandet. | Only cases that were escalated can be reopened. | unit + `disputes.int` |
| M3 | A user measure could close an unrelated report, or one the moderator had made. | The report must be about that member; the conflict-of-interest check applies. | `moderation-measures.int` |
| M4 | Case and booking steps had no limits. | 60 case steps and 40 booking steps a day per person; a case takes at most 400 party entries and pages load a bounded number. | `disputes.int` |
| L1 | Two staff deciding the same appeal at once could undo a measure twice; the reporter could decide the appeal. | Decided once (status-guarded update); nobody involved in the case decides. | `moderation-measures.int` |
| L2 | Both parties accepting a recommendation at the same moment left the case open; a recommendation could land in a closed case. | Steps in one case are serialised with a row lock and a fresh status check. | `disputes.int` (fails without the lock) |
| L3 | Contesting a return while a «not returned» case was open failed. | The objection is added to the open case. | `disputes.int` |
| L4 | The data export was a GET, so another site could use up the daily quota. | A same-origin POST from the account page. | e2e `security.spec` |
| L5 | A restricted member could not add condition or case photos; an account waiting for erasure could not finish the booking that blocks the erasure. | New action `evidence.upload`; deletion-pending accounts may take part in bookings, claims and cases. | policy unit + `security.int` |
| L6 | The new-conversation limit ran inside the transaction, so its audit row was rolled back. | Checked before the transaction. | `messaging.int` |
| L7 | Database functions with elevated rights had `search_path = public` only. | `public, pg_temp` (`0010`). | migration |
| — | The per-email rate-limit key was an unkeyed hash. | HMAC with the server's hash key. | `security.int` |

### Tested (run locally on 25.10.2026, PostgreSQL 16, Chromium from Playwright 1.63)
- **Unit (Vitest): 204 passed**: the policy for every Phase 01–03 action (79 cases), case rules (deadlines, escalation, reopening), review windows, redaction of logged errors.
- **Integration (Vitest against `laandet_test`): 109 passed.** New for Phase 03: cases (flow, grants, audited views, privileges, triggers, N12, photo access, races), reviews, account measures and appeals, admin sections and transparency, data export, retention and erasure, inactivity, SEC-21 and N6.
- **End-to-end (Playwright, production build): result recorded after the local run finishes.** New: two case journeys at 390 px with axe checks, admin and transparency, reviews at the end of the rental journey, and security (foreign `Origin` refused, session cookie attributes, a deleted account signed out at once, the export as POST).
- **CI (`laandet-ci`):** result recorded after the push.

### Not done / known gaps
- **Owner decisions needed** (see `docs/ASVS_L1.md`): minimum password length 10 or 12; whether rolling 30-day sessions are acceptable for members; OSV-Scanner in CI.
- **Transparency:** no figures entered. The owner enters them in `/admin/apenhet` when the first invoices exist.
- **Legal texts and `DISPUTE_POLICY.md` are drafts, not legally reviewed.**
- Rentals stay closed (`rentals_open` off) and category B stays blocked.
- Needs the server (Phase 04): TLS/HSTS, DNS, backups with a real restore test, the worker on a schedule, real email delivery.
- No antivirus for uploads (only re-encoded images are accepted; accepted risk). No password strength meter or «Vis passord».
- Not tested here: Safari/WebKit.

## [Phase 02] — 25.10.2026 (approved by the owner: «Zatwierdzam Phase 02»; not deployed)

### Added
- **Messages (P02-01):**
  - one conversation per listing and person, started from the listing page («Send melding»);
  - plain text only, shown as text (N9), with a payment-link warning for both sender and reader;
  - blocking in both directions; an active booking or handover keeps the thread open until it is finished;
  - reporting a message to the moderation queue;
  - new replies appear by polling, without a reload;
  - email notices batched: at most one per conversation and recipient per 15 minutes, never with the message text, and not for messages read within 2 minutes;
  - rate limits: 5 new conversations/day and 60 messages/hour for new accounts (20/day and 200/hour for established ones).
- **Rental requests and bookings (P02-02):**
  - «Send forespørsel» on the listing page, only while the `rentals_open` flag is on (default off). It has date and time in Europe/Oslo, handover and return method from the listing's options, an optional message, and a price preview before sending;
  - a pure, unit-tested state machine for every status × event × role;
  - the database refuses overlapping active bookings (exclusion constraint) and any category B booking (`mvp_category_a_only`);
  - the booking stores a snapshot of the terms;
  - owner accept/decline within 72 hours, renter withdraw, cancel with a reason, a private meeting place for the two parties only;
  - every step writes `booking_events`, posts a system message in the thread and notifies the other party;
  - `/leieforhold` (active, requests, finished, giveaways) and `/leieforhold/[id]` (next step, terms, history);
  - a listing cannot be archived or deleted while a booking or handover is under way. Open requests are declined with a notice.
- **Agreements (P02-04):**
  - the simplified rental agreement is rendered once from the template and the terms snapshot (logic-less Mustache, every value Markdown-escaped) and stored with its SHA-256;
  - numbers `LA-YYYY-NNNNNN` and `GB-YYYY-NNNNNN` from a database sequence;
  - `/leieforhold/[id]/avtale` shows an overview, the stored text, the hash, the acceptances and «Jeg godtar avtalen». The form posts the hash of the text shown, and a database trigger checks party and hash again;
  - when both have accepted, the booking is confirmed;
  - a change of period or handover/return method before handover creates a new revision. The old one is superseded and both must accept again;
  - English readers also see an informational English rendering («Den norske teksten gjelder»);
  - the runtime role cannot change a contract's text, terms or hash, only its status.
- **Giveaway claims (P02-03):**
  - «Jeg vil gjerne ha den» (one per person per listing, shared limit with requests);
  - the giver sees all claims on the listing page with «Velg» and «Avslå». Choosing one reserves the listing and tells the others «ikke valgt nå»;
  - `/overlevering/[id]`: both confirm the exact transfer text after the handover → «Gitt bort». Either can cancel before that, and the listing is published again.
- **Condition reports (P02-05):**
  - `/leieforhold/[id]/utlevering` and `/tilbakelevering`: each party's own entries (condition, function, damage, accessories, fuel/battery, cleanliness, serial number, notes), photos straight from the phone camera (`capture="environment"`), re-encoded without metadata;
  - entries, photos and confirmations are append-only. A correction is a new entry that supersedes the author's own earlier one, and any new entry resets earlier confirmations;
  - the handover needs the five-point checklist and both confirmations → handed over;
  - a return entry → return pending; both confirm → completed with the proposed outcome; a contest → disputed, with a minimal dispute record (the full dispute flow is P03-01);
  - «Ikke tilbakelevert» for the owner from 24 hours after the end;
  - condition photos are served only to the two parties (N13). Staff also get 404 until the audited dispute grant in P03.
- **Worker jobs and notices (P02-06):**
  - jobs `booking_request_expiry`, `agreement_expiry`, `handover_lapse` (category A, one confirmation, 24 hours after the start, labelled «Bekreftet av én part»), `return_lapse` (72 hours without an answer), `return_reminder` (at the end, then 24 hours later with a notice to the owner), `giveaway_claim_expiry` (14 days) and `message_email_batch`;
  - each row is handled in its own transaction with a row lock and a status check. System transitions are written to `booking_events` with no actor;
  - `/varsler` (newest first, opened = read) and unread counts for «Meldinger» and «Varsler» in the header;
  - emails are a short notice and a link, never message text, prices or addresses. Essential notices are sent even when the user turned optional emails off.

### Tested (run locally on 25.10.2026, PostgreSQL 16, Chromium from Playwright 1.63)
- **Unit (Vitest): 157 passed**, including:
  - the booking state machine;
  - pricing and period limits;
  - contract rendering: every template tag present in nb/en/giveaway, deterministic, Markdown injection escaped;
  - message rules;
  - Oslo date/time conversion including summer time.
- **Integration (Vitest against `laandet_test`): 59 passed.** New for Phase 02:
  - full rental flow with history, notices and system messages;
  - overlap refused by the service and by the database;
  - only the parties (404 for others);
  - closed flag and blocked pairs;
  - N4;
  - change of terms and cancel;
  - the runtime role cannot alter a contract or forge an acceptance;
  - listing kept while in use;
  - giveaway claims (select, second select refused, the trigger refuses another person's acceptance, withdraw reopens, decline);
  - condition reports (checklist, confirmations reset by a newer entry, a correction only by its author, append-only privileges, contested return → dispute, «Ikke tilbakelevert» timing, N13 photo access);
  - each worker job with a fake clock (the right rows move, a second run changes nothing, events have no actor);
  - messaging (privacy, blocking, limits, reports, email batching).
- **End-to-end (Playwright, production build): 34 passed** (31 from Phase 01 plus 3 new). The two new journeys run at 390 px with axe (WCAG 2.1 AA) checks on each new page:
  - rental: request → accept → both accept the agreement → handover with a photo → return → completed. A third user gets 404 for the photo and the booking;
  - giveaway: claim → choose → both confirm → «Gitt bort»;
  - messaging (on the Pixel 7 profile): N2 + N9, the payment warning and polling.
- **CI (`laandet-ci`):** green on 25.10.2026 for all five jobs on commit `3cdee3b` (lint/format/types, unit, integration on PostgreSQL 17, build + Playwright, secrets/audit).

### Not done / known gaps
- **Rentals are closed by default.** `rentals_open` is off until the owner decides to open them. Category B stays blocked (BankID, deposits and the extended agreement are later phases).
- **Agreement texts are drafts.** They are not legally reviewed, and the pages show the draft banner.
- The dispute flow is minimal: a record and a notice. Negotiation, support review and staff access with an audited grant come in P03-01.
- The worker jobs were tested with a fake clock in integration tests. They have not run on a schedule on a real server, and real SMTP delivery is not tested.
- No archiving of conversations in the UI (the column exists).
- Not tested here: Safari/WebKit.

## [Phase 01] — 25.10.2026 (approved by the owner: «Zatwierdzam Phase 01»; not deployed)

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
