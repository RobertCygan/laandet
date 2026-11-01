# Laandet — Architecture

**Status:** Designed (Phase 00). Nothing here is implemented yet.
**Decisions referenced:** see [`DECISIONS.md`](DECISIONS.md). **Data model:** [`DATA_MODEL.md`](DATA_MODEL.md).
**Security:** [`SECURITY.md`](SECURITY.md), [`THREAT_MODEL.md`](THREAT_MODEL.md), [`AUTH_MODEL.md`](AUTH_MODEL.md).

## 1. Principles

1. **One deployable app, one database.** A single Next.js application and a single PostgreSQL database. There are no microservices, message brokers or search clusters.
2. **Modules inside the app, not services.** Each business area is a folder with a clear public interface. Modules call each other only through those interfaces.
3. **The server decides.** Every rule is enforced on the server: authorisation, state transitions, the value threshold, the restricted-item policy and rate limits. The UI only reflects these rules.
4. **The database is the last line of defence.** It enforces foreign keys, check constraints, unique constraints, exclusion constraints (no double booking), and append-only privileges for evidence.
5. **Boring, pinned dependencies.** Few libraries, all well maintained, versions pinned with a lockfile.
6. **Data stays in the EU/EEA.** The server, database, backups and email provider are all located there.

## 2. System overview

```
                 Browser (mobile first, nb / en)
                          │  HTTPS only (HSTS)
                          ▼
┌───────────────────────── EU VPS (Docker Compose) ─────────────────────────┐
│  caddy  ── TLS (Let's Encrypt), security headers, request size limits     │
│     │                                                                     │
│     ▼                                                                     │
│  app (Next.js 16, Node 22)                                                │
│   ├─ pages: React Server Components + Server Actions                      │
│   ├─ /api/auth/*        Better Auth handler                               │
│   ├─ /media/:key        authorised image delivery                         │
│   └─ /healthz           liveness/readiness                                │
│     │            │                                                        │
│     ▼            ▼                                                        │
│  db (PostgreSQL 17)    media volume (/data/media, not web-served)         │
│     ▲                                                                     │
│  worker (same image)  ── every minute: email outbox, expiries, reminders, │
│                          review windows, retention clean-up               │
└──────────────┬──────────────────────────────────┬─────────────────────────┘
               │ SMTP (TLS)                       │ nightly encrypted backup (restic)
               ▼                                  ▼
        EU email provider                 off-site storage (EU)
        (Scaleway TEM / Brevo)            (Storage Box / object storage)

Optional: Sentry EU (errors, no PII), UptimeRobot (uptime).
Future (Phase 05, not built): IdentityProvider (BankID via OIDC broker), PaymentProvider.
```

## 3. Application structure (`laandet/app/`, created in Phase 01)

```
laandet/app/
├─ src/
│  ├─ app/                         Next.js routes (thin: render + call module actions)
│  │  ├─ [locale]/                 nb (default, no prefix) | en (/en)
│  │  │  ├─ page.tsx               Hjem
│  │  │  ├─ utforsk/               Utforsk annonser
│  │  │  ├─ annonse/[id]/          Annonsedetaljer
│  │  │  ├─ gis-bort/              Gis bort (filtered explore)
│  │  │  ├─ ny-annonse/            Legg ut annonse (wizard)
│  │  │  ├─ mine-annonser/         Mine annonser
│  │  │  ├─ profil/[id]/           Public profile
│  │  │  ├─ konto/                 Min profil, settings, delete account
│  │  │  ├─ meldinger/             Messages
│  │  │  ├─ foresporsler/          Rental requests (incoming/outgoing)
│  │  │  ├─ leieforhold/[id]/      My rentals: agreement, handover, return, problem
│  │  │  ├─ saker/                 Disputes and support
│  │  │  ├─ slik-fungerer-det/, trygghet/, stott-laandet/, apenhet/
│  │  │  ├─ vilkar/, personvern/, informasjonskapsler/, retningslinjer/...
│  │  │  └─ admin/                 Moderation and administration (staff + 2FA)
│  │  ├─ api/auth/[...all]/route.ts
│  │  ├─ media/[key]/route.ts
│  │  └─ healthz/route.ts
│  ├─ modules/                     Business logic (no React)
│  │  ├─ config/        env validation (zod), feature flags
│  │  ├─ auth/          Better Auth setup, session helpers, sign-up confirmations
│  │  ├─ authz/         policy functions: can(actor, action, resource)
│  │  ├─ users/         profiles, account status, deletion
│  │  ├─ listings/      listings, categories, localities, availability, restricted-item rules
│  │  ├─ media/         upload pipeline, MediaStore (disk; S3 later)
│  │  ├─ search/        full-text + filters
│  │  ├─ bookings/      state machine, requests, overlap rules
│  │  ├─ giveaways/     claims, transfer confirmation
│  │  ├─ messaging/     conversations, messages, blocks
│  │  ├─ contracts/     template rendering, snapshots, acceptances
│  │  ├─ condition/     handover/return reports, photos, confirmations
│  │  ├─ disputes/      cases, evidence, proposals, escalation
│  │  ├─ reviews/       double-blind reviews
│  │  ├─ moderation/    reports, actions, appeals
│  │  ├─ notifications/ in-app notifications + email outbox
│  │  ├─ legal/         legal document versions and acceptances
│  │  └─ audit/         append-only audit events
│  ├─ db/              Drizzle schema (one file per module) + client (runtime role)
│  ├─ i18n/            next-intl routing and formatters (kr, dates)
│  └─ ui/              design system components ported from the prototype
├─ messages/           nb.json, en.json
├─ drizzle/            SQL migrations (forward) + documented rollback notes
├─ worker/             worker entry point (scheduled jobs)
├─ tests/              e2e (Playwright), fixtures
├─ Dockerfile, compose.yaml, compose.dev.yaml, Caddyfile
└─ .env.example        names only, never values
```

### Module contract

Each module exposes four kinds of files:

- `*.schema.ts` — Zod schemas for inputs. The same schema validates the form on the client and the action on the server.
- `*.service.ts` — Functions with the shape `(ctx, input) → result`.
  - `ctx` holds `{ actor, db, now, locale }`.
  - The service validates the input, checks the policy (`authz`), runs one database transaction and writes audit events.
- `*.queries.ts` — Read models for pages. Every query is scoped by the actor, for example `listMyBookings(actor)`. There is no generic "get anything by id" query.
- `*.actions.ts` — Next.js Server Actions. Each is a thin adapter: get the session, call the service, map errors to localised messages.

Pure logic lives in plain functions with no I/O, so it can be unit-tested cheaply:

- the booking state machine
- the contract category rule
- deposit validation
- the restricted-category rule
- price calculation
- return-outcome rules

### Request lifecycle (write)

```
Form (client, zod pre-check)
  → Server Action (CSRF/origin checked by Next.js)
  → getSession() (Better Auth; status must be active)
  → zod parse (server, authoritative)
  → rate-limit check (per user + per IP bucket)
  → service: authz.can(actor, action, resource) → domain rules → db transaction
  → audit_events insert (same transaction)
  → notifications / email_outbox insert (same transaction)
  → revalidate affected pages → localised result
```

## 4. Key subsystems

### 4.1 Authentication and authorisation
See [`AUTH_MODEL.md`](AUTH_MODEL.md).

- **Better Auth** mounts at `/api/auth/*` and uses the same PostgreSQL database through its Drizzle adapter.
- **Account status** (`active`, `restricted`, `suspended`, `deletion_pending`, `deleted`) is checked on every request.
- **Suspension and deletion** revoke all sessions immediately.

### 4.2 Listings and search
- **Listing types:**
  - `rent_out` — Leies ut. Includes free lending when the price is 0.
  - `wanted` — Ønskes leid.
  - `give_away` — Gis bort.
- **Validation:** one Zod schema per type, plus server rules:
  - declared value is required for `rent_out`
  - deposit ≤ declared value
  - `give_away` price is always 0 and known defects is a required field (the user may write "Ingen kjente feil")
  - the category must not be `prohibited`; a `restricted` category requires safety confirmations
- **Search:** one SQL query combining:
  - a full-text `tsvector` (generated column)
  - `pg_trgm` similarity on the title
  - filters by type, category, locality, price, delivery option and availability window
  - keyset pagination

  Sorting is "newest first" by default; "lowest price" is the only alternative. The ranking parameters are stated on the explore page (transparency).

### 4.3 Booking engine
- **State machine:** the pure function `transition(booking, event, actor)` returns the next state or a typed error. Details in [`DATA_MODEL.md`](DATA_MODEL.md) §5.
- **Overlap protection:** an exclusion constraint on `(listing_id, period)` for active statuses. Requests do not reserve dates; acceptance does.
- **Category B gate:** the server refuses `requested` for category B listings until the `extended_agreements` flag and identity verification are live (D-011).

### 4.4 Contracts
- **Rendering:** templates are Markdown with named placeholders. They are filled from a typed `ContractTerms` object, never from free user HTML.
- **Snapshot:** the rendered text and its SHA-256 hash are stored. Each acceptance stores the hash the user saw.
- **Material change:** a new contract version is created and the old one is marked `superseded`.
- See [`RENTAL_AGREEMENTS.md`](RENTAL_AGREEMENTS.md).

### 4.5 Condition reports and disputes
- **Condition reports:** append-only entries per party, photos linked to entries, and confirmations bound to the latest entry. See [`CONDITION_REPORTS.md`](CONDITION_REPORTS.md).
- **Disputes:** case state, events, proposals and evidence, with staff facilitation. See [`DISPUTE_POLICY.md`](DISPUTE_POLICY.md).

### 4.6 Media pipeline
1. Receive the file via a Server Action or route handler with a streaming size limit (10 MB per file, max 8 files per listing).
2. **Sniff magic bytes.** Allow JPEG, PNG, WebP and HEIC/HEIF (HEIC only if the sharp build can decode it; otherwise reject with a clear message). Ignore the client MIME type and file name.
3. **Decode with sharp** under `limitInputPixels` (40 megapixels). Auto-rotate from EXIF, then **drop all metadata** (EXIF, GPS, XMP, ICC except sRGB).
4. **Re-encode to WebP:**
   - display size, max 1 600 px long edge
   - thumbnail, 480 px
5. Store under a random key (`uuidv7`), as `media/<scope>/<uuid>.webp`, where scope is `public-listing` or `private-condition`/`private-dispute`. Store the SHA-256 of the re-encoded bytes.
6. **Serve via `/media/:key`:**
   - The route looks up the `media_objects` row and checks visibility: listing published, or actor is a booking party, or staff with an active grant.
   - Headers: `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`.
7. Re-encoding removes the original file's structure, which neutralises most malicious image payloads. No PDFs or other document types are accepted in the MVP, so ClamAV is not needed yet. It is required before any document upload type is added.

### 4.7 Messaging
- **Storage:** conversations are tied to a listing, booking or giveaway claim. Messages are stored as plain text.
- **Rendering:** React text nodes only. No `dangerouslySetInnerHTML`, no Markdown, no auto-linking.
- **Delivery:** polling every 20 s on open conversation pages, plus email notification batching (one email per conversation per 15 minutes). WebSockets are not needed for the pilot.

### 4.8 Notifications and email
- **In-app:** rows in the `notifications` table.
- **Email:**
  - Emails are rendered from localised templates in the recipient's language. Delivery goes through `email_outbox`, sent by the worker with exponential backoff (5 attempts).
  - Emails never contain message bodies or exact addresses. They contain a short notice and a link.

### 4.9 Internationalisation
- **Library and routing:** `next-intl`, `nb` default (no prefix), `en` under `/en`.
- **Language choice:** saved in a cookie (strictly necessary preference) and in `user_profiles.locale` for emails.
- **Formatting:** dates as `14.12.2026` in both locales (Norwegian context), and amounts with `Intl.NumberFormat('nb-NO')`: `1 500 kr`.
- **Category names:** stored as JSONB `{ "nb": "...", "en": "..." }`, editable in admin without schema changes.
- **Legal texts:** shown in the chosen language. English pages carry a banner saying the Norwegian text prevails.

### 4.10 Configuration and feature flags
- **Environment variables:** validated at startup with Zod. The app refuses to start on missing or invalid values. `.env.example` lists names only.
- **Feature flags:** stored in the `feature_flags` table and editable by administrators (audited).

  | Flag | Default | Purpose |
  |---|---|---|
  | `show_demo_listings` | on until launch | Show prototype examples (labelled) |
  | `high_value_preview` | **off** | Allow non-bookable category B previews |
  | `extended_agreements` | **off** | Unlock category B bookings (Phase 05 prerequisites) |
  | `captcha_turnstile` | off | Turn on CAPTCHA at sign-up if abuse appears |
  | `passkeys` | off | Offer passkey sign-in |
  | `rentals_open` | off until the rental agreement is legally reviewed | Enables the request → agreement flow for «Leies ut» (fallback launch, `DEVELOPMENT_ROADMAP.md` §5) |
| `registrations_open` | on | Pause sign-ups in an incident |
  | `listings_open` | on | Pause new listings in an incident |

### 4.11 Background worker
- **What it is:** a Node entry point (`worker/index.ts`) in the same image, run as a separate container with a 60-second loop.
- **Jobs** are idempotent and use `SELECT … FOR UPDATE SKIP LOCKED`:

  | Job | Frequency |
  |---|---|
  | Send email outbox | each loop |
  | Expire unanswered requests (72 h) | each loop |
  | Expire unaccepted agreements (48 h or start time) | each loop |
  | Handover and return reminders (24 h before) | each loop |
  | Mark overdue returns (end + 24 h, notify only, never auto-accuse) | each loop |
  | Open and close review windows; publish double-blind reviews | each loop |
  | Retention clean-up (see `PRIVACY.md`) | nightly |
  | Delete expired sessions and verification tokens | nightly |

## 5. Environments

| Environment | Where | Data | Email | Access |
|---|---|---|---|---|
| `development` | developer machine, `compose.dev.yaml` (Postgres + Mailpit) | seed data only | Mailpit | local |
| `test` | GitHub Actions (Postgres service container) | created per run | Mailpit / in-memory | CI |
| `staging` | same VPS, separate Compose project, `staging.<domain>` | synthetic data only, **never copies of production** | provider sandbox or Mailpit | basic auth + `noindex` |
| `production` | VPS | real | EU provider | public |

Each environment has its own database, database roles, `BETTER_AUTH_SECRET` and SMTP credentials.
Secrets live in a root-owned `.env` file on the server (mode 600) and in GitHub Actions encrypted
secrets for deployment. They are never committed.

## 6. Deployment (Phase 01 deliverable, P01-13)

1. CI runs lint, typecheck, unit tests, integration tests, migration test, build, end-to-end tests, dependency audit and secret scan.
2. On a tag `laandet-v*`, CI builds the Docker image and pushes it to GitHub Container Registry.
3. A deploy job connects over SSH with a deploy-only key and a restricted user, then:
   1. `docker compose pull`
   2. `docker compose run --rm migrate` (migration role)
   3. `docker compose up -d app worker`
4. A health check on `/healthz` must pass. If not, re-deploy the previous image tag.
5. **Rollback of the database:**
   - Migrations are forward-only and written to be backward compatible: expand, then contract in a later release.
   - Each migration file carries a comment describing its manual rollback.
   - For a destructive failure, restore from the pre-deploy dump, which the deploy job takes automatically.

## 7. Observability
- **Logs:**
  - Structured JSON (pino) containing request id, user id (UUID), route, status and duration.
  - **Never logged:** email addresses, message text, passwords, tokens, exact addresses.
  - Docker log rotation keeps logs for 30 days.
- **Errors:** Sentry EU (optional) with PII scrubbing.
- **Health:** `/healthz` checks the database connection and the media volume.
- **Admin dashboard:** counts only (users, listings, bookings by status, open reports, open disputes, outbox backlog, failed jobs).

## 8. Future integration seams (designed, not built)

```ts
// modules/identity/provider.ts — Phase 05 (BankID via an OIDC broker)
interface IdentityProvider {
  startVerification(userId: string, returnUrl: string): Promise<{ redirectUrl: string }>;
  completeVerification(callback: URLSearchParams): Promise<{
    userId: string;
    level: 'strong';
    providerRef: string;
    verifiedAt: Date;
  }>;
  // Never returns or stores fødselsnummer. Only an opaque, provider-scoped subject id.
}

// modules/payments/provider.ts — Phase 05 (authorised payment provider)
interface PaymentProvider {
  createRentalPayment(bookingId: string, amountOre: bigint): Promise<PaymentIntentRef>;
  authorizeDeposit(bookingId: string, amountOre: bigint): Promise<DepositAuthRef>;
  releaseDeposit(ref: DepositAuthRef): Promise<void>;
  captureDeposit(ref: DepositAuthRef, amountOre: bigint, settlementId: string): Promise<void>; // only with a recorded settlement
  refund(ref: PaymentIntentRef, amountOre: bigint): Promise<void>;
  handleWebhook(req: Request): Promise<PaymentEvent>;
}
```

Neither interface is implemented in the MVP. The UI must not suggest otherwise.

## 9. Growth path (only when measured need appears)

| Signal | Step |
|---|---|
| CPU or RAM consistently > 70% | Resize VPS (minutes, no code change) |
| Media > 50 GB or bandwidth costs | Switch `MediaStore` to S3-compatible EU object storage |
| Database > 10 GB or need for point-in-time recovery | Managed PostgreSQL in an EU region |
| Expansion beyond Steigen | Add municipalities to `localities`; nothing else in the schema needs to change |
| Real-time chat demand | Server-Sent Events on the existing app before considering WebSockets |
