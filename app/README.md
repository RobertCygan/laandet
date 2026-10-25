# Laandet — web application

Next.js (App Router) + PostgreSQL + Drizzle + Better Auth. Phase 01 covers user accounts, all three listing types,
image uploads, explore/search, legal pages, reporting and minimal moderation. Phase 02 adds messages, rental
requests and bookings, agreements, giveaway claims, condition reports, and the worker jobs and notices around them.
Phase 03 adds cases between the parties with staff help, reviews, account measures and appeals, the admin panel,
data export, retention and account erasure, and the transparency page. Phase 04 adds feedback, the staging banner,
operations alerts (`OPS_ALERT_EMAIL`), «Vis passord» and `npm run release:check`. Architecture and decisions:
`../docs/ARCHITECTURE.md` and `../docs/DECISIONS.md`.

The UI is in Norwegian Bokmål (default, no URL prefix) and English (`/en/...`). Code and comments are in English.

## Requirements

- Node.js 22 (`>=22.12 <23`)
- PostgreSQL 16 or 17, with the `pg_trgm` and `btree_gist` extensions
- No other services are needed for development. Emails are written to the log when `SMTP_URL` is empty.

## First run

```bash
npm ci
cp .env.example .env.local            # then fill in the secrets (see the comments in the file)
sudo -u postgres sh scripts/db-setup-local.sh   # local roles + laandet_dev / laandet_test (dev passwords)
npm run db:migrate                    # migration role (DATABASE_MIGRATION_URL)
npm run db:seed -- --demo             # localities, categories, flags, keywords + labelled demo listings
npm run legal:load                    # legal texts from ../legal into the database
npm run dev                           # http://localhost:3000
npm run worker                        # separate terminal: emails, deadlines, reminders and clean-up jobs
```

Rental requests are closed until the `rentals_open` flag is on (category B stays blocked either way). An admin
switches it at `/admin/flagg` with a reason (audited).

To give someone a staff role (server only, audited):
`npm run grant-role -- --email ola@example.no --role moderator --reason "…"`. The person must then set up
two-factor sign-in at `/konto/tofaktor` before `/admin` opens.

## Commands

| Command                                                       | What it does                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev` / `npm run build` / `npm start`                 | Next.js dev server, production build, production server                                                                                    |
| `npm run lint` / `npm run format:check` / `npm run typecheck` | ESLint (incl. security rules), Prettier, TypeScript                                                                                        |
| `npm run test:unit`                                           | Vitest unit tests (`src/**/*.test.ts`)                                                                                                     |
| `npm run test:integration`                                    | Vitest against the `laandet_test` database (migrations, seed and legal load run first)                                                     |
| `npm run build && npm run test:e2e`                           | Playwright (mobile + desktop) against the production build on port 3100                                                                    |
| `npm run db:generate`                                         | Generate a migration from `src/db/schema` (review the SQL before committing)                                                               |
| `npm run worker -- --once`                                    | Run every worker job once and exit                                                                                                         |
| `npm run release:check`                                       | Release gates code can check (legal markers and drafts; in production demo listings and the sender address). Exits 1 while blockers remain |

Tests only ever use databases whose name ends in `_test`. Override the URLs with `TEST_DATABASE_URL` and
`TEST_DATABASE_MIGRATION_URL`.

## Structure

```
src/
  app/[locale]/…     pages (server components); no direct database access (ESLint rule)
  app/api/auth/…     Better Auth handler
  app/media/…        authorised image delivery
  modules/           domain logic: auth, authz (central policy), listings, media, messaging, rentals, giveaways,
                     condition, disputes, reviews, moderation, admin, privacy, feedback, ops (alerts), release
                     (release check), legal, users, notifications, audit, ratelimit, flags, config (validated env)
  ui/                components (forms are client components using Server Actions)
  db/schema/         Drizzle schema (snake_case); drizzle/ holds the SQL migrations
  proxy.ts           CSP nonce, request id and locale routing
worker/              background jobs (email outbox, message emails, booking/claim deadlines, reminders, restriction
                     expiry, review publishing, account erasure, inactivity warnings, clean-up, retention)
scripts/             migrate, seed, legal loader, grant-role, local database setup
messages/            nb.json and en.json (same keys; checked by a unit test)
tests/               integration (Vitest) and e2e (Playwright) tests
```

## Security notes

- The runtime role `laandet_app` has least privilege. Audit events, legal acceptances, booking history, agreements,
  condition evidence, case files and staff access grants are append-only for it, and legal texts are read-only.
  Migrations and the legal loader use `laandet_owner`. Retention purges run through fixed-period database
  functions that the app cannot pull forward (`0010`).
- CSP with a per-request nonce and `strict-dynamic`. No third-party scripts, fonts or analytics.
- Every write goes through `can()` in `src/modules/authz/policy.ts`. Objects that are not yours give 404.
- Uploaded images are checked by their content, re-encoded to WebP and stripped of all metadata.
  They are stored outside the web root under random names.
- No money, card data or fødselsnummer is handled or stored.
