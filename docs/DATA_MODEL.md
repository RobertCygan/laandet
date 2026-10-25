# Laandet — MVP Data Model

**Status:**
- **Designed.** The SQL reference schema [`../db/schema-draft.sql`](../db/schema-draft.sql) is validated (§9).
- **Not implemented.** Phase 01 expresses it in Drizzle and generates the real migrations.

**Conventions:**
- Identifiers are UUIDs.
- Money is `bigint` øre (`*_ore`), in NOK only.
- Timestamps are `timestamptz`.
- Enumerations are `text` columns with `CHECK` constraints.

## 1. Entity map

```
users ─┬─ user_profiles (1:1)          localities ─┐
       ├─ sessions / accounts / …       categories ─┤
       ├─ identity_verifications                     │
       └─ user_blocks                                ▼
                                    listings ─┬─ listing_images ── media_objects
                                              ├─ listing_unavailability
                                              ├─ saved_listings
                                              └─ conversations ─┬─ conversation_participants
                                                                └─ messages
                       ┌──────────────────────────┴───────────────┐
                       ▼                                          ▼
                   bookings (rent_out)                     giveaway_claims (give_away)
                   ├─ booking_events                       └─ contracts (giveaway_transfer)
                   ├─ contracts (rental_simple|extended)       └─ contract_acceptances
                   │   └─ contract_acceptances
                   ├─ condition_reports (handover|return)
                   │   ├─ condition_entries ── condition_photos ── media_objects
                   │   └─ condition_confirmations
                   ├─ disputes ─┬─ dispute_events (── media_objects)
                   │            └─ dispute_proposals
                   └─ reviews

reports → moderation_actions → appeals        support_access_grants
legal_document_versions → legal_acceptances / contracts.template_version_id
notifications · email_outbox · feature_flags · audit_events · app_rate_limits · worker_heartbeats
```

## 2. Mapping to the entities suggested in the master specification

| Suggested entity | Implemented as | Note |
|---|---|---|
| `User` | `users` (Better Auth) | `users.name` is the public display name. |
| `UserProfile` | `user_profiles` | role, status, locality, locale, sign-up self-declarations, `last_seen_at` (inactivity) |
| `IdentityVerification` | `identity_verifications` | MVP: email only (`basic`). BankID = `strong`, Phase 05. |
| `Listing` | `listings` | three types in one table, type-specific `CHECK`s |
| `ListingCategory` | `categories` | names/icons in JSONB, policy, `allow_paid_rental` |
| `ListingImage` | `listing_images` + `media_objects` | |
| `ListingAvailability` | `listing_unavailability` + active `bookings` | available unless blocked or booked |
| `RentalRequest` | `bookings` with `status = 'requested'` | D-013 |
| `Booking` | `bookings` | |
| `Conversation` / `Message` | `conversations`, `conversation_participants`, `messages` | one conversation per (listing, interested user) |
| `Contract` | `contracts` | also used for the *Gis bort* transfer confirmation |
| `ContractAcceptance` | `contract_acceptances` | bound to the text hash, guarded by trigger |
| `HandoverReport` / `ReturnReport` | `condition_reports` (`phase`) + `condition_entries` + `condition_confirmations` | see `CONDITION_REPORTS.md` |
| `ConditionPhoto` | `condition_photos` + `media_objects` | |
| `DepositRequirement` | `listings.deposit_ore` (offer) + `bookings.deposit_ore` (agreed snapshot) | no money is held (D-012) |
| `Dispute` / `DisputeEvidence` | `disputes`, `dispute_events`, `dispute_proposals` | |
| `Review` | `reviews` | double-blind (`sealed` → `published`) |
| `Report` | `reports` | notice-and-action |
| `ModerationAction` | `moderation_actions` (+ `appeals`) | statement of reasons stored |
| `Notification` | `notifications` + `email_outbox` | |
| `AuditEvent` | `audit_events` | append-only by privilege |
| `LegalDocumentVersion` | `legal_document_versions` (+ `legal_acceptances`) | |

## 3. Key business rules enforced in the database

| Rule | Where |
|---|---|
| Value category A ≤ 5 000 kr (500 000 øre) < B | `listings.value_category` generated column |
| "Leies ut" needs price, unit, declared value, condition | `rent_out_requires_terms` |
| Deposit ≤ declared value | `deposit_not_above_value` (listings and bookings) |
| "Gis bort" is free and must state known defects | `give_away_is_free` |
| A published offer has at least one handover option | `published_offer_has_handover` |
| Delivery fee/radius only when delivery is offered | `delivery_fields_need_delivery` |
| No double booking | `bookings_no_overlap` exclusion constraint (statuses `accepted`…`return_pending`) |
| No category B bookings in the MVP | `mvp_category_a_only` (removed only by a Phase 05 migration) |
| Nobody rents their own item | `CHECK (owner_id <> renter_id)` |
| One live agreement per booking | `contracts_one_live_per_booking` |
| Acceptance must match text and party | trigger `contract_acceptance_guard` |
| One selected recipient per giveaway | `giveaway_one_selected` |
| One open dispute per booking | `disputes_one_open_per_booking` |
| One review per author per booking, no self-review | `UNIQUE (booking_id, author_id)`, `CHECK` |
| Evidence cannot be edited or deleted by the app | privileges (§8) |

Rules that need context (who the actor is, time, feature flags) are enforced in the service layer:
- whether the renter is email-verified
- whether the category is prohibited, restricted or paid-rental-blocked
- deadlines
- which transitions a given actor may perform

## 4. Listing lifecycle

```
            publish (validation ok, category allowed)
  draft ───────────────────────────────────────────▶ published ◀──── resume ──── paused
    ▲                                                  │  │  │                     ▲
    │ edit (any time; booked terms are snapshots)      │  │  └──── pause ──────────┘
    │                                                  │  │
    │                                       give_away: │  └── archive ─▶ archived ─▶ (delete)
    │                                 select claim ▼   │
    │                                  reserved ── transfer confirmed ─▶ given_away
    │
  moderator: published|paused ─▶ removed (statement of reasons) ─▶ published (appeal upheld)
  owner delete: any (no active booking/claim) ─▶ deleted (soft; purged by retention job)
```

Before an owner can **delete** a listing or switch it to a non-bookable state, the service checks
for active bookings (`accepted` … `return_pending`). Those must finish or be cancelled first.

## 5. Rental (booking) state machine

| From | Event | Actor | To | Guard |
|---|---|---|---|---|
| — | `request` | renter | `requested` | listing published, `rent_out`, category A, paid rental allowed if price > 0, not blocked, dates inside availability, renter email-verified and active, owner active |
| `requested` | `accept` | owner | `accepted` | no overlap (DB), within `owner_response_due_at`; creates contract rev. 1 |
| `requested` | `decline` | owner | `declined` | optional reason |
| `requested` | `withdraw` | renter | `withdrawn` | |
| `requested` | `expire` | system | `expired` | `owner_response_due_at` passed (72 h) |
| `accepted` | `accept_contract` (2nd party) | owner/renter | `confirmed` | both acceptances on the live contract |
| `accepted` | `change_terms` | owner/renter | `accepted` | old contract `superseded`, new revision, acceptances reset |
| `accepted` | `agreement_timeout` | system | `expired` | `agreement_due_at` passed (48 h or start time) |
| `accepted`/`confirmed` | `cancel` | owner/renter | `cancelled` | before handover; reason required; counterparty notified |
| `confirmed` | `change_terms` | owner/renter | `accepted` | material change → new contract, both accept again |
| `confirmed` | `handover_confirmed` | system | `handed_over` | both parties confirmed the handover report; or (category A only) one party confirmed and the other did not react within 24 h after the agreed start. In that case the report is stored as `lapsed` = **"bekreftet av én part"** (see `CONDITION_REPORTS.md` §4). |
| `confirmed` | `handover_contested` | renter | `confirmed` | renter contests the recorded condition before taking the item; owner may correct (new entry) or either party may cancel |
| `handed_over` | `return_recorded` | owner/renter | `return_pending` | return entry by either party |
| `return_pending` | `return_agreed` | system | `completed` | both confirm the return report with outcome `returned_ok` / `returned_normal_wear` |
| `return_pending` | `return_contested` | owner/renter | `disputed` | a party contests, or outcome `returned_with_deviation` not confirmed by the other party |
| `return_pending` | `return_confirmation_lapsed` | system | `completed` | one party confirmed and the other did not respond within 72 h. The report is stored as **"bekreftet av én part"**, never as mutual agreement. The other party keeps the right to report a problem within the deadlines in `DISPUTE_POLICY.md`. |
| `handed_over` | `mark_not_returned` | owner | `not_returned` | earliest 24 h after the end of the period, after a reminder |
| `not_returned` | `return_recorded` | owner/renter | `return_pending` | item came back late |
| `completed` | `open_dispute` | owner/renter | `disputed` | within the reporting deadline |
| `disputed` | `dispute_closed` | system | `completed` | the dispute closes; the outcome stays on the dispute record, not on the booking |

Terminal statuses: `declined`, `withdrawn`, `expired`, `cancelled`, `completed`.
`completed` can still go to `disputed`.

Implementation:
- A pure function `transition(booking, event, actor, now)` returns the next state or a typed error. It is unit-tested exhaustively (every state × event × actor).
- Every transition writes a `booking_events` row in the same transaction.

## 6. Giveaway ("Gis bort") state machine

| From | Event | Actor | To |
|---|---|---|---|
| — | `claim` | interested user | claim `requested` (listing stays `published`) |
| claim `requested` | `select` | giver | claim `selected`, listing `reserved`; other claims are notified "ikke valgt nå" but stay `requested` |
| claim `requested` | `decline` / `withdraw` / `expire` (14 days) | giver / claimant / system | `declined` / `withdrawn` / `expired` |
| claim `selected` | `cancel` | giver or claimant | claim `cancelled`, listing back to `published` |
| claim `selected` | both accept the transfer confirmation | giver + recipient | claim `transferred`, listing `given_away`, other open claims `expired` |

## 7. Dispute state machine (summary — full rules in `DISPUTE_POLICY.md`)

```
open ─▶ awaiting_response ─(respondent replies)─▶ in_negotiation ─(proposal accepted)─▶ resolved_by_agreement
            │ (7 days no reply)                         │ (either party asks for help)
            └───────────────────────▶ support_review ◀──┘
                                       │   ├─▶ awaiting_documentation ─▶ support_review
                                       │   ├─▶ resolved_by_agreement (parties accept recommendation)
                                       │   ├─▶ closed_without_agreement (+ guidance on external options)
                                       │   ├─▶ referred_to_insurer / referred_to_authority
any non-closed state ─(opener withdraws)─▶ withdrawn
```

## 8. Database roles and privileges

| Role | Used by | Rights |
|---|---|---|
| `laandet_owner` | migrations only (CI deploy step) | owns all objects |
| `laandet_app` | app + worker | `SELECT, INSERT, UPDATE, DELETE` on ordinary tables. **`SELECT, INSERT` only** on `audit_events`, `booking_events`, `contract_acceptances`, `condition_entries`, `condition_confirmations`, `condition_photos`, `dispute_events`, `legal_acceptances`. On `contracts`: `UPDATE` only of `status` and `superseded_at`. No writes on `legal_document_versions`. |
| `laandet_readonly` (optional) | owner's ad-hoc reporting | `SELECT` on non-personal aggregates via views only |

Retention deletes on append-only tables run through narrowly scoped `SECURITY DEFINER` functions
owned by `laandet_owner`, for example `purge_expired_audit_events()`.

## 9. Validation record

| Date | What | Result |
|---|---|---|
| 25.10.2026 | Applied `db/schema-draft.sql` to an empty PostgreSQL **16** database (Ubuntu package, `pg_trgm` and `btree_gist` contrib) | Applied without errors: 45 tables plus roles and grants |
| 25.10.2026 | Ran `db/schema-checks.sql`: 23 checks covering listing rules, double booking, category B block, self-rental, contract hash and party guard, one live contract, self-review, runtime-role privileges | **All 23 passed** (`ALL SCHEMA CHECKS PASSED`) |

How to reproduce:
```bash
createdb laandet_schema_check
psql -v ON_ERROR_STOP=1 -d laandet_schema_check -f laandet/db/schema-draft.sql
psql -v ON_ERROR_STOP=1 -d laandet_schema_check -f laandet/db/schema-checks.sql
```

Production target is PostgreSQL 17. The schema uses nothing that changed between 16 and 17.

### 9a. Phase 01 implementation (25.10.2026)

- The application schema is defined in `app/src/db/schema/` (Drizzle, snake_case). It is applied by the SQL migrations in `app/drizzle/`:
  - `0000_extensions.sql`: `pg_trgm`, `btree_gist`.
  - `0001_init.sql`: Phase 01 tables. Better Auth tables (`users`, `sessions`, `accounts`, `verifications`, `two_factors`, `rate_limits`), plus profiles, localities, categories, listings, media, reports, moderation actions, appeals, legal documents and acceptances, email outbox, flags, rate limits, audit log.
  - `0002_privileges.sql`: grants for `laandet_app`. UPDATE/DELETE are revoked on `audit_events` and `legal_acceptances`, and the app role can only read `legal_document_versions`. Also a `purge_expired_audit_events()` function.
- Tables for Phase 02+ (bookings, agreements, condition reports, disputes, reviews, conversations) are **not** in the migrations yet. They stay in `db/schema-draft.sql` until their phase.
- **Difference from the reference schema (D-034):** the "complete terms" checks on `listings` apply only when `status <> 'draft'`, so drafts can be saved step by step. Value checks apply to drafts too: amounts ≥ 0, deposit ≤ value, radius 1–300 km, dates in order.
- **What is tested against the real migrations** (integration tests, `app/tests/integration/`):
  - the runtime role cannot UPDATE/DELETE the audit log or acceptances, and cannot write legal texts;
  - listing publish rules, category B block, free-only categories;
  - owner-only edits and visibility;
  - moderation and appeal rules.

  The 23 checks in `db/schema-checks.sql` still apply to the reference schema only. They are not run against the Drizzle migrations, because those do not contain the Phase 02+ tables yet.

## 10. Open modelling questions for the owner

1. **Hourly rentals:** keep the `hour` price unit (listed in the master spec)? It complicates
   the calendar a little. *Recommendation:* keep it, but the booking UI books whole hours on a single day.
2. **Several identical items** (for example two kayaks) in one listing? *Recommendation:*
   one listing = one physical item in the MVP (simplest overlap rule). Owners create two listings.
3. **Saved listings ("Lagre")** from the prototype. *Recommendation:* keep it (one small table).
