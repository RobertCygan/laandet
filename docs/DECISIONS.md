# Architecture and Product Decisions (ADR log)

Each decision records context, the choice, the trade-off and its status.

**Status values:**
- **Proposed** — recommended, waiting for the project owner.
- **Accepted** — approved by the owner (with date and how it was approved).
- **Superseded** — replaced by a later decision.

The owner approved Phase 00 on 25.10.2026, which accepted D-001…D-029 as recommended. Decisions added
during Phase 01 start as *Proposed* (implementation-level) unless the owner says otherwise.

---

## D-001 — Two interface languages: Norwegian Bokmål (default) and English
- **Context:** The master prompt asks for a Norwegian Bokmål interface and centralised strings. The owner added "Norwegian lang. and english lang" at the top of the prompt. Many Steigen residents, seasonal workers and visitors read English better than Norwegian.
- **Decision:**
  - The UI ships in `nb-NO` (default; it owns the URL root `/`) and `en` (under `/en`).
  - All strings live in message catalogs (`messages/nb.json`, `messages/en.json`), handled by `next-intl`.
  - Legal documents are written in Norwegian. English versions are informational translations, and each one says the Norwegian text prevails.
  - User-generated content (listings, messages) is shown as written and is never machine-translated.
- **Trade-off:** About 15–20% more UI copy work and a second set of legal texts to keep in sync. It is far cheaper to do from day one than to retrofit.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»). English UI and informational English legal translations are both in scope.

## D-002 — Repository location
- **Context:** This session can only reach `RobertCygan/G-PSI_WWW`, which hosts the G-PSI website (`www/`) and the prototype.
- **Decision:**
  - Laandet lives in the self-contained folder `laandet/`: docs, legal texts, design assets, and from Phase 01 the app in `laandet/app/`.
  - The G-PSI website build (`www/`) is not touched.
  - When the owner creates a dedicated repository (recommended: `laandet`), move the folder with `git subtree split` to keep history.
- **Trade-off:** Shared CI configuration and issue tracker for a while. Workflows must use `paths:` filters so one product's changes don't run the other's checks.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-003 — Product name
- **Decision:**
  - Use "Laandet" in all new code, text, domains and assets.
  - The prototype file `Laanndet.html` keeps its historical name and is not modified.
  - The wordmark in the new UI reads "Laandet." (the prototype's dotted wordmark style).
- **Status:** Required by the master specification.

## D-004 — Application stack
- **Context:** The master specification prefers Next.js, TypeScript, Tailwind, PostgreSQL and Prisma/Drizzle. The G-PSI site uses TanStack Start with an external auth broker (see `CURRENT_STATE_ASSESSMENT.md` §4). The prototype's React source is not available.
- **Decision:**

  | Layer | Choice (versions checked 25.10.2026) |
  |---|---|
  | Web framework | **Next.js 16** (App Router, React Server Components, Server Actions), TypeScript `strict` |
  | Styling | **Tailwind CSS 4** with the prototype's design tokens as theme variables |
  | Database | **PostgreSQL 17** |
  | Data access | **Drizzle ORM** (0.45.x) with SQL migrations committed to the repo |
  | Authentication | **Better Auth** (1.7.x), self-hosted in the same app and database |
  | Validation | **Zod**, with schemas shared by forms and server |
  | i18n | **next-intl** |
  | Image processing | **sharp** |
  | Tests | **Vitest** (unit and integration), **Playwright** (end-to-end) |
  | CI | **GitHub Actions** |

- **Why Drizzle over Prisma:**
  - Plain SQL migrations that can be reviewed.
  - No separate query engine binary.
  - Easy use of PostgreSQL features the design depends on: range types, exclusion constraints, full-text search.
- **Why Better Auth:**
  - Maintained and open source (MIT), and it runs inside our own app and database, so there is no external identity broker or per-user fee.
  - Covers what we need: email verification, password reset, rate limiting, session revocation, TOTP two-factor and passkey plugins.
  - The project behind Auth.js joined Better Auth in 2025, so it is the mainstream choice in this ecosystem.
- **Trade-off:**
  - Next.js is heavier than a minimal server, but well documented and familiar to any developer or AI assistant who picks up the project.
  - Self-hosted auth means we own patching. Mitigated by pinning versions, Dependabot and CI audits.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-005 — Hosting: one EU virtual server with Docker Compose
- **Context:** Low cost and EU/EEA data residency are priorities. Managed platforms cost about 40–70 USD per month at minimum and are mostly US companies; Vercel Hobby forbids commercial use. Hetzner raised prices in April and June 2026, and its cheapest plans may not be orderable for new customers (see `OPERATING_COSTS.md`).
- **Decision:**
  - One Linux VPS with at least 2 vCPU and 4 GB RAM in an EU/EEA data centre. Hetzner (Helsinki or Germany) is preferred if available; otherwise any comparable EU provider.
  - It runs Docker Compose with: `app` (Next.js standalone build), `worker` (same image, scheduled jobs), `db` (PostgreSQL 17) and `caddy` (TLS certificates, reverse proxy, security headers).
  - Staging runs on the same server as a separate Compose project, with its own database, secrets and subdomain, protected by basic auth and `noindex`.
- **Trade-off:**
  - Cheapest and simplest, and all data stays in one EU place.
  - It is a single point of failure and the owner must keep the OS updated. Mitigations: unattended security upgrades, nightly encrypted off-site backups, a tested restore runbook, and an uptime monitor.
  - Moving later to managed Postgres or a second server needs no code change, only configuration.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»). Buying the server is still a separate owner action; nothing is ordered by the developer.

## D-006 — Media storage behind the application
- **Decision:**
  - Uploaded images are stored on the server's disk (a Docker volume), outside the web root, under random UUID keys, behind a small `MediaStore` interface (`put`, `get`, `delete`).
  - Public listing images are served by an app route that checks the listing is published.
  - Private images (condition photos, dispute evidence) are served by the same route only to authorised users, with `Cache-Control: private, no-store`.
  - An S3-compatible adapter (Hetzner Object Storage, Scaleway, Cloudflare R2 with EU jurisdiction) can be added when disk or bandwidth demands it.
- **Trade-off:** No CDN and no extra service. Disk is included in the server price. Images are included in the off-site backup. Fine for a pilot of a few thousand users.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-007 — Authentication policy
- **Decision:**
  - Email and password sign-up. Email must be verified before a user can publish, message or book.
  - Password reset by email link.
  - Passwords:
    - At least 10 characters.
    - Checked against known breached passwords (Better Auth "Have I Been Pwned" plugin, k-anonymity, no password leaves the server).
    - Hashed with scrypt (Better Auth default).
  - Sessions:
    - HTTP-only, `Secure`, `SameSite=Lax`, `__Host-` prefixed cookies.
    - Expire after 30 days, or 8 hours for staff.
    - Revoked on password change, suspension and deletion.
  - Passkeys: optional for users, added in Phase 01 if time allows.
  - TOTP two-factor: **mandatory** for moderators and administrators before they can use `/admin`.
  - Bot protection at launch: rate limits, a hidden honeypot field, a minimum form-fill time and email verification. Cloudflare Turnstile is prepared behind a feature flag and switched on only if abuse appears, because it adds a third-party (US) processor.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-008 — Transactional email
- **Decision:**
  - Send through SMTP to an EU provider. Recommended: Scaleway Transactional Email (pay per use) or Brevo (free tier, 300 per day).
  - Every email goes through an `email_outbox` table with retries, so a provider outage does not break sign-up or bookings.
  - Mailpit catches all email in development and CI.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»). The owner still chooses the provider and creates the account.

## D-009 — Money representation
- **Decision:**
  - All amounts are integers in **øre** (1 kr = 100 øre), stored as `bigint` columns named `*_ore`. NOK is the only currency.
  - Formatting is `Intl.NumberFormat('nb-NO')`, for example `1 500 kr`.
  - No floating-point arithmetic on money.
- **Status:** Required by the master specification.

## D-010 — Pilot participants: private persons aged 18+
- **Context:**
  - Business sellers ("næringsdrivende") bring extra duties: consumer information, trader traceability, possibly platform reporting. The pilot does not need them.
  - Under Norwegian guardianship law, minors cannot freely enter binding agreements.
- **Decision:**
  - At sign-up the user confirms (1) they are at least 18, (2) they use Laandet as a private person, not in business, and (3) they accept the terms. Each confirmation is stored with a timestamp.
  - No date of birth and no fødselsnummer is collected.
  - The interface never presents age as verified.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-011 — Value threshold and the high-value block
- **Decision:**
  - Every "Leies ut" listing must have a declared approximate replacement value.
    - **Value ≤ 5 000 kr (≤ 500 000 øre):** category A, simplified agreement.
    - **Value > 5 000 kr:** category B, extended agreement.
  - **In the MVP the server refuses rental requests and bookings for category B.**
  - A category B listing can be saved as a draft. It is published as a non-bookable "Kommer senere" preview only if the owner switches on the feature flag `high_value_preview` (default **off**).
  - Category B bookings unlock only when all three are true:
    1. Identity verification (`IdentityVerification.level = 'strong'`) is live for both parties.
    2. A reviewed deposit procedure is approved.
    3. The flag `extended_agreements` is on.
- **Trade-off:**
  - Some valuable items (e-bikes, large tools) cannot be rented in the pilot.
  - Accepted for safety. Owners can still give such items away or lend them outside the platform.
  - Owners might under-declare value to avoid the block. The terms forbid it, the agreement records the declared value (which weakens the owner's own claim if under-declared), and moderators can review suspicious listings.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-012 — No money flows through Laandet in the MVP
- **Decision:**
  - Laandet records the agreed price and any agreed deposit as **terms of the agreement only**.
  - The parties settle directly (cash, Vipps, bank transfer). Laandet never receives, holds, refunds or deducts money.
  - The UI warns before every agreement: off-platform payments have no platform protection, and Laandet never sends payment links.
  - A future `PaymentProvider` interface is documented in `ARCHITECTURE.md` but not implemented.
- **Status:** Required by the master specification.

## D-013 — One `bookings` table also represents rental requests
- **Context:** The master specification lists `RentalRequest` and `Booking` as separate entities.
- **Decision:**
  - A rental request is a `bookings` row with status `requested`. Accepting it moves the same row forward.
  - Overlap protection (a PostgreSQL exclusion constraint) applies only from `accepted` onward, so several people can request the same dates.
- **Trade-off:** One state machine, one history, no copying of data between tables. Requests and bookings are separated by status in queries.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-014 — Reviews only after completed rentals, published double-blind
- **Decision:**
  - Each party can review the other once per completed rental, within 14 days of completion.
  - A review stays hidden until both have reviewed or the 14 days pass, so neither side can retaliate.
  - Giveaways have no reviews in the MVP. Profiles show the verified count of completed giveaways instead.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-015 — Messaging rules
- **Decision:**
  - A conversation always belongs to a listing (a question about it) or to a booking or giveaway claim. There are no free direct messages.
  - Messages are plain text, rendered as text. Links are not made clickable, and the UI warns about payment links.
  - Users can block and report.
  - Moderators cannot browse conversations. They see only:
    - the messages a participant attaches to a report, and
    - for an escalated dispute, the booking conversation, after both parties have been told it will be reviewed.
  - Every staff view is written to the audit log with a reason.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-016 — Giveaways use a simple separate flow
- **Decision:**
  - Interested users send a `giveaway_claim` with a message. The giver picks one claim, which reserves the item.
  - Both parties confirm the transfer: a *Gis bort — overleveringsbekreftelse* snapshot with condition and known defects. The listing then becomes "Gitt bort".
  - No rental agreement, no deposit, no condition report.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-017 — No maps and no distances in the MVP
- **Decision:**
  - Location is a locality from an admin-managed list (Leinesfjord, Nordfold, Engeløya and so on) plus optional free text such as "nær skolen".
  - Search filters by locality, with no distance, travel time or map tiles.
- **Trade-off:** Less visual than the prototype's planned map toggle, but honest, cheaper and better for privacy. Maps (for example Kartverket open tiles) can come later.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-018 — Background work without a queue service
- **Decision:** A `worker` process (same codebase) runs every minute and handles:
  - the email outbox
  - expiring stale requests
  - reminders before handover and return
  - opening review windows
  - retention clean-up

  State lives in PostgreSQL tables, and each job is safe to run twice.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-019 — Search with PostgreSQL only
- **Decision:**
  - PostgreSQL full-text search (`norwegian` and `simple` configurations combined) plus `pg_trgm` for typo tolerance.
  - Filters run as SQL `WHERE` clauses. Availability uses a range-overlap check against bookings and blocked periods.
- **Trade-off:** More than enough for tens of thousands of listings. No external search server.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-020 — "Ønskes leid" responses
- **Decision:**
  - A reply to a wanted listing is a message in a conversation tied to that listing. The replier can attach a link to one of their own "Leies ut" listings.
  - The actual rental always happens as a request on a "Leies ut" listing, so every rental uses the same agreement, condition and dispute machinery.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-021 — Agreements are immutable snapshots
- **Decision:** When the owner accepts a request:
  1. The server renders the correct template version (A or B) with the booking terms.
  2. It stores the full text and its SHA-256 hash.
  3. Each party accepts that exact hash.
  4. Changing any material term (dates, price, deposit, handover method, accessories) supersedes the agreement and requires both acceptances again.
- **Status:** Required by the master specification.

## D-022 — Append-only evidence enforced by database privileges
- **Decision:** The application connects with a runtime database role that has **no `UPDATE` or `DELETE`** on these tables:
  - `audit_events`
  - `contract_acceptances`
  - `condition_entries`
  - `condition_confirmations`
  - `dispute_events`
  - `giveaway_transfer_confirmations`

  Migrations run with a separate owner role. Corrections are new rows that point to the row they supersede.
  Personal-data deletion is the one exception: a narrowly scoped `SECURITY DEFINER` function, used only by the retention job, can redact or remove expired rows.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-023 — Legal documents as versioned files
- **Decision:**
  - Legal texts are Markdown files in `laandet/legal/nb/` (authoritative) and `laandet/legal/en/` (translations), each with a version header.
  - At deploy, the app loads them into `legal_document_versions` with a content hash. Users accept a specific version.
  - A new material version asks users to accept again at their next login.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-024 — Demo listings
- **Decision:**
  - Prototype examples may be seeded with `is_demo = true`. They always carry an "Eksempel" badge and cannot be requested or messaged.
  - They are excluded from profiles and statistics.
  - A feature flag `show_demo_listings` lets the owner hide them all once enough real listings exist.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-025 — No analytics or tracking in the MVP
- **Decision:**
  - No analytics scripts, no advertising or tracking cookies, no fingerprinting.
  - Only strictly necessary cookies: session, CSRF/state, language choice.
  - Operational metrics come from the database (counts) and server logs (kept 30 days), so no cookie banner is needed.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-026 — Voluntary support ("Støtt Laandet")
- **Decision:**
  - The page explains voluntary support and running costs.
  - It shows a fundraising link only when the owner sets `SUPPORT_CAMPAIGN_URL` for a real, verified campaign (for example Spleis). Until then it says no fundraiser has started.
  - No payment code exists in Laandet. See `SUPPORT_AND_FUNDING.md`.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»).

## D-027 — Error monitoring
- **Decision:**
  - Sentry in its EU (Frankfurt) data region on the free Developer plan, with personal data scrubbing (`sendDefaultPii: false`, no request bodies, user id only).
  - UptimeRobot free tier for uptime.
  - Both are optional. The app runs without them.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»). Accounts are created by the owner when needed.

## D-028 — Paid rental of "means of transport" paused until the reporting question is clarified
- **Context:** Norway's platform-reporting rules (DPI, skatteforvaltningsloven § 7-11, in force from income year 2026) can oblige a platform to collect and report seller identity data. This includes tax identification numbers, which is close to collecting fødselsnummer. The rules cover rental of **means of transport**.
  - Trailers, bicycles, kayaks, canoes and SUP boards may fall under "means of transport".
  - It is unclear whether a platform that does not process payments, but records the agreed price, is covered.
  - Research summary is in `LEGAL_REVIEW_CHECKLIST.md` L-07.
- **Decision:**
  - Categories `tilhengere`, `sykler` and `padling` start with `allow_paid_rental = false`. These items can be lent free of charge (0 kr), given away or wanted, but not rented for money.
  - The owner asks a lawyer, or Skatteetaten through a binding advance ruling, in week 1.
  - If the answer is "not reportable", or the owner accepts the reporting duty, an admin flips the flag; no code change is needed.
- **Trade-off:** Trailers and kayaks are popular in the prototype. Pausing paid rental reduces early usefulness but avoids building identity/tax data collection that the MVP otherwise does not need.
- **Alternatives:**
  - (a) Accept the risk and launch with paid rental, and register as a reporting platform if required.
  - (b) Implement DPI data collection for those categories only.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»): paid rental of these categories stays off until the DPI question is answered (flag per category, no code change needed).

## D-029 — Geography
- **Decision:**
  - Listings must be located in one of the admin-managed localities in Steigen kommune: Leinesfjord, Leines, Nordfold, Engeløya, Nordskot, Bogøy, Helnessund and Bogen. Others can be added by an admin.
  - Users may live anywhere.
  - Adding other municipalities needs no schema change.
- **Status:** Accepted 25.10.2026 (owner approved Phase 00: «Zatwierdzam Phase 00»). The locality list can be edited later without code changes.

## D-030 — Rendering and locale routing (implementation)
- **Context:** Next.js 16.4 enables Cache Components by default. A per-request CSP nonce needs dynamic rendering, and every page shows a session-aware header, so the static shell would gain little.
- **Decision:**
  - `cacheComponents: false`; all pages render per request.
  - Locale routing is done in `src/proxy.ts`: `nb` without prefix (internally rewritten to `/nb/...`), English under `/en/...`, and `/nb/...` redirects to the canonical URL.
  - No locale cookie and no automatic language detection. The language is in the URL, and the user's choice is also stored in `user_profiles.locale` for emails.
  - next-intl is used for messages and formatting only.
- **Consequence:** the cookie list shrinks. `NEXT_LOCALE` is not used, and `PRIVACY.md` and the cookie page are updated to match.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-031 — Money in TypeScript
- **Decision:**
  - Database columns stay `bigint` øre.
  - The TypeScript layer uses `number`, validated as a safe integer (`Number.isSafeInteger`), because no realistic amount comes close to 2^53 øre.
  - `formatKr` also accepts `bigint`.
  - There is no floating-point arithmetic on money; kroner input is parsed into integer øre at the boundary.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-032 — Search and pagination (implementation)
- **Context:** P01-10 asked for keyset pagination and a separate `src/modules/search/` module.
- **Decision:**
  - Explore uses one parameterised query in `src/modules/listings/queries.ts`, with offset pagination: 24 per page, at most 50 pages.
  - Real listings are always ranked before demo listings.
- **Reason:** In Steigen, result sets are small. Offset pages keep shareable URLs simple (`?side=2`), and the cap stops deep-page scans. Keyset pagination can replace this without changing the URL format if volumes grow.
- **Not done:** the `EXPLAIN` plan fixture from P01-10. The indexes (GIN full text, trigram, filters) exist in the migration.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-033 — Legal texts rendered without raw HTML
- **Decision:**
  - Legal Markdown is rendered with `react-markdown` + `remark-gfm` with `skipHtml`.
  - Raw HTML and HTML comments are never output.
  - Links are rewritten to app routes, and only `https:`, `mailto:` and internal paths survive.
  - `dangerouslySetInnerHTML` is not used anywhere. ESLint forbids it, which is stricter than P01-11, where it was allowed in one component.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-034 — Drafts may be incomplete; database checks enforce published listings
- **Decision:**
  - The "complete terms" `CHECK` constraints (rent-out price/value/condition, give-away condition, description length) apply only when `status <> 'draft'`.
  - Checks that protect stored values always apply, for drafts too: no negative amounts, deposit ≤ value, radius 1–300 km, dates in order. The service checks the same rules first (`storageViolations`), so users get field errors instead of a database error.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-035 — Restricted accounts stay signed in; the policy limits them
- **Context:** P01-05 §5 suggested treating `suspended` and `deletion_pending` accounts as signed out, except on the appeal pages.
- **Decision:**
  - Only `deleted` accounts are treated as signed out (and cannot create sessions).
  - `suspended` and `deletion_pending` accounts keep their session but may only view and appeal (`authz/policy.ts`). Their account page shows a status notice.
  - `deletion_pending` sessions are revoked when deletion is requested, so in practice only suspended users are affected.
- **Reason:** A suspended user must be able to read the statement of reasons and appeal (DSA-style good practice). Denying actions in one central policy is easier to test than special-casing pages.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-036 — Re-acceptance of material legal changes
- **Decision:**
  - When a `terms` or `privacy` version is loaded with `material_change: true`, signed-in users who have not accepted that version (or a later one) see a banner.
  - They must accept on `/godta-vilkar` before they can publish. `saveListing` refuses with `terms_acceptance_required`, and `/ny-annonse` redirects to the acceptance page.
  - Browsing is not blocked.
  - Acceptances are append-only rows in `legal_acceptances`.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-037 — Browser tests run against the production build
- **Decision:**
  - Playwright starts `next start` on port 3100 against the `*_test` database after `npm run build`.
  - The test helpers refuse any database whose name does not end in `_test`.
- **Reason:** In this environment the Turbopack dev server reloaded pages in a loop ("HMR hash mismatch"). Production builds are also what users get.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-038 — Staff 2FA setup and role changes
- **Decision:**
  - Roles are granted only through the server CLI (`npm run grant-role -- --email … --role … --reason …`). The change is audited, existing sessions are revoked, and other admins are emailed.
  - Staff set up TOTP themselves at `/konto/tofaktor`: re-enter password → key + backup codes shown once → confirm with a code.
  - The secret is shown as text and an `otpauth://` link. No QR code library is used (KISS; very few staff members).
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-039 — HEIC photos
- **Context:** `TEST_STRATEGY.md` lists HEIC as an accepted upload format. The prebuilt `sharp` binary used here decodes AVIF but not HEIC, because of HEVC licensing.
- **Decision:**
  - The file picker asks for JPEG, PNG or WebP. iOS then converts camera photos to JPEG automatically.
  - A HEIC file picked on a computer is rejected with a clear message. Content sniffing still recognises it.
- **Revisit:** if pilot users report problems, decode HEIC in a separately licensed step (for example a libheif build on the server). This needs an owner decision on codec licensing.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-040 — Deployment layout (P01-13 implementation)
- **Decision:**
  - **One Caddy for both environments.** It runs as its own Compose project (`deploy/compose.edge.yaml`), because only one process can own ports 80/443. Each environment has its own edge network, and only its `app` container joins it. Staging and production cannot reach each other, and Caddy cannot reach any database.
  - **One image, two kinds of process.**
    - `node server.js` runs the Next.js standalone server.
    - The worker and the scripts (migrate, load-legal, seed, grant-role) are bundled with esbuild into `tools/*.mjs`, so the image needs no second `node_modules` tree (about 440 MB instead of about 1.3 GB). `sharp` is resolved from the standalone `node_modules`.
  - **Trigger.** Tags `laandet-v*` (a `-staging` suffix means staging) or a manual run, both gated by the repository variable `LAANDET_DEPLOY_ENABLED`. Merging is safe: nothing deploys until the owner turns it on. Production uses a GitHub environment with required reviewers. The SSH deploy key is limited to a forced command.
  - **Each deploy:** pre-deploy database dump → migrations (owner role) → legal texts (production refuses placeholders) → idempotent seed (staging adds `--demo`) → app and worker → health check. A failure rolls back to the previous image.
  - **`/healthz` is public** for an uptime monitor and exempt from the staging password. Caddy writes no access log (SEC-43), and its admin API is off.
  - **Pinned images and actions.** Base images are pinned by digest (`node:22.23.4-bookworm-slim`, `postgres:17.11-bookworm`, `caddy:2.11.7`). GitHub Actions in the deploy workflow are pinned to commit SHAs (checked against their release tags on 25.10.2026).
  - **Containers:** read-only root filesystem, non-root user, all capabilities dropped. The only writable paths are `/data/media` and `/tmp`, and the database has no published port.
  - **Backups:** nightly restic backup (database dump + media) to EU storage, with a scripted restore into a throwaway environment for the restore test. Staging is not backed up.
- **Verified locally with Docker (not on a real server):**
  - the image builds;
  - a staging deploy with Caddy's internal CA, plus an automatic rollback after a deliberately broken image;
  - the production guard stops on placeholder legal texts;
  - backup → restore into a throwaway environment with matching row counts;
  - `shellcheck`, `actionlint`, `docker compose config` and `caddy validate` all pass.
- **Not verified:** Let's Encrypt, GHCR pushes, the workflow on GitHub, the SSH forced command, off-site storage, the systemd timer on a real server, and the first real restore test. These need the server and domain.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).

## D-041 — Better Auth endpoints are not public
- **Context:** An independent security review found that the catch-all `/api/auth/*` route exposed every Better Auth endpoint. Calling them directly skipped the app's own checks: consent records, bot checks, per-account rate limits, re-authentication for email changes and audit logging. An email change without a password could lead to account takeover with a stolen session.
- **Decision:**
  - Only the two links sent by email are served over HTTP: `GET /api/auth/verify-email` and `GET /api/auth/reset-password/:token`. Everything else returns 404.
  - All other auth operations go through our Server Actions, which call `auth.api.*` on the server.
  - Session rows store a keyed hash of the IP (SEC-43) and a shortened user agent.
- **Status:** Accepted 25.10.2026 (owner approved Phase 01: «Zatwierdzam Phase 01»).
