# Laandet — Test Strategy

**Status:** Designed (Phase 00). The only tests that exist today are the schema checks in `db/schema-checks.sql`. They were
**executed on 25.10.2026 against PostgreSQL 16, and all 23 passed** (see `DATA_MODEL.md` §9).

**Rule:** A test is reported as passed only if it ran and passed in CI or in a recorded local run. Never claim
results that were not produced.

## 1. Test pyramid (practical, not exhaustive)

| Layer | Tool | Scope | Target size (MVP) |
|---|---|---|---|
| Unit | Vitest | pure domain logic: state machines, contract selection, value threshold, deposit rules, price and money formatting, restricted-category rules, return-outcome rules, authorisation decisions (`can()`), Zod schemas | ≈ 150–250 tests |
| Integration | Vitest + real PostgreSQL (CI service container; Docker locally) | services with the database: auth flows, listing CRUD, uploads, search, messaging, requests, contracts, condition reports, disputes, moderation, retention jobs, **negative authorisation tests** | ≈ 120–200 tests |
| Database | `psql` scripts | schema invariants (`db/schema-checks.sql`, later run against the Drizzle migrations) | 1 script, run on every CI build |
| End-to-end | Playwright (Chromium; mobile viewport 390×844 + desktop 1280×900) | critical user journeys and abuse cases in the browser against a production build | ≈ 15–25 specs |
| Manual | checklist | mobile usability with real residents, accessibility spot-checks (VoiceOver/TalkBack), restore test, security headers | per release |

Avoid snapshot tests of whole pages and duplicate tests of the same rule at several layers. Test each rule
once at the lowest layer that can prove it, plus one end-to-end journey that ties the rules together.

## 2. Unit tests (master spec §22)

| Area | Must cover |
|---|---|
| Listing validation | per type; title and description lengths; give_away price is forbidden; give_away needs known defects; at least one handover option |
| Value thresholds | 499 999 / 500 000 / 500 001 øre → A / A / B |
| Deposit requirements | deposit ≤ value; category B requires a deposit > 0 (for the future); deposit is shown before a request |
| Booking states | every (state × event × actor) combination → expected next state or typed error (table-driven) |
| Contract selection | rent_out A/B, give_away, wanted → error |
| Return condition states | outcome rules; "confirmed by one party" never shown as mutual |
| Access control decisions | `can()` for every cell of `AUTH_MODEL.md` §4 |
| Currency calculations | units × price; hourly/day/weekend/week; total in øre as `bigint`; formatting `1 500 kr`; no floats |
| Paid-rental block | price > 0 rejected where `allow_paid_rental = false` |

## 3. Integration tests

| Feature | Key cases |
|---|---|
| Registration and verification | sign-up stores three confirmations; unverified user cannot publish, message or request; verification link single-use and expiring; rate limits → 429 |
| Sign-in, session, reset | generic error; reset revokes other sessions; suspended user's session invalid on next request |
| Listing creation | each type; prohibited category rejected; restricted needs acknowledgement; owner-only edit/pause/archive/delete |
| Photo uploads | valid JPEG/PNG/WebP/HEIC accepted; EXIF GPS removed; SVG, HTML-as-JPG, polyglot and over-size rejected; 9th image rejected |
| Search | full-text (Norwegian stemming: "tilhengeren" finds "tilhenger"); filters; availability excludes booked periods; demo listings flagged |
| Messages | participant-only access; blocked users cannot contact each other; plain text stored and returned |
| Rental requests | category B rejected; overlap rejected at acceptance; expiry after 72 h |
| Contract acceptance | stale hash rejected; non-party rejected; material change creates a new revision and resets acceptances |
| Handover and return | entries append-only; confirmations invalidated by a new entry; lapse rule; contest → dispute |
| Dispute creation | deadlines; proposal accept/reject; cannot accept own proposal; escalation creates a time-boxed grant; staff view audited |
| Moderation | hide listing with statement of reasons; appeal by a different reviewer; restricted user cannot publish |
| Retention | each job deletes exactly what `PRIVACY.md` §5 says, and nothing else |

## 4. Mandatory negative tests (master spec §22) → where they live

| # | Negative test | Layer |
|---|---|---|
| N1 | User A cannot edit User B's listing (404) | integration + e2e |
| N2 | User A cannot read User B's private conversation (404) | integration + e2e |
| N3 | Unverified users cannot bypass required verification | integration |
| N4 | A listing above 5 000 kr cannot complete a rental without the required safeguards | unit + integration + database `CHECK` |
| N5 | Restricted equipment cannot be rented through an unauthorised workflow (no ack, prohibited category, paid rental blocked) | integration |
| N6 | A user cannot force a deposit refund or deduction (no such endpoint; deposit fields immutable after acceptance) | integration |
| N7 | One participant cannot forge the other's acceptance | integration + database trigger (already passing in `schema-checks.sql`) |
| N8 | Invalid files cannot bypass upload validation | integration |
| N9 | Malicious HTML or scripts are not executed (listing, message, review, display name) | e2e (checks DOM and listens for dialogs and CSP violations) |
| N10 | Deleted or blocked users cannot keep active sessions | integration |
| N11 | A donation is never required to register or publish | e2e (full journey with no support page visit) |
| N12 | A pending complaint is not shown as a confirmed crime (not public, neutral wording) | integration + e2e |
| N13 | User C cannot fetch condition photos of booking A–B (404) | integration |
| N14 | Moderator without 2FA cannot open `/admin` | integration |
| N15 | Staff cannot read a conversation without a report or dispute grant | integration |

## 5. End-to-end journeys (Playwright)

1. **Rental journey** (master spec §22):
   1. Register (Mailpit captures the verification email).
   2. Verify email.
   3. Create listing.
   4. Upload photos.
   5. Second user sends a request.
   6. Owner accepts.
   7. Both accept the agreement.
   8. Record handover.
   9. Record return.
   10. Complete.
   11. Both leave a review; the review appears after both have submitted.
2. **Gis bort journey:** publish giveaway → two users claim → giver selects one → both confirm transfer → listing "Gitt bort", other claim expired.
3. **Ønskes leid journey:** publish wanted → another user replies with a link to their own listing → requester sends a request on that listing.
4. **Dispute journey:** contested return → dispute → proposal → counter-proposal → accept → resolved.
5. **Moderation journey:** report listing → moderator hides it with reasons → owner appeals → second staff reverses.
6. **Language journey:** switch to English → UI strings in English; legal page shows the "Norwegian prevails" banner; formats remain `1 500 kr` and `14.12.2026`.
7. **Abuse cases** N1, N2, N9, N11, N12 in the browser.

Each journey runs at a mobile viewport. The rental journey also runs at desktop size.

## 6. CI pipeline (GitHub Actions, `paths: laandet/**`)

| Job | Contents | Blocking |
|---|---|---|
| `lint` | ESLint (incl. security rules, `no-restricted-syntax` for `dangerouslySetInnerHTML` and `sql.raw`), Prettier check | yes |
| `typecheck` | `tsc --noEmit` | yes |
| `unit` | Vitest unit | yes |
| `db` | apply migrations to an empty Postgres 17 service, run `db/schema-checks.sql`, check that the Drizzle schema matches the migrations | yes |
| `integration` | Vitest integration against Postgres + Mailpit | yes |
| `build` | `next build` (production) | yes |
| `e2e` | Playwright against the production build | yes |
| `security` | gitleaks (secrets), `npm audit --audit-level=high`, OSV-Scanner | yes (high/critical) |
| `deps` | Dependabot security PRs (separate) | — |

## 7. Release checks (manual, per release; mandatory before the pilot)

- [ ] Backup restore test performed and logged (SEC-53).
- [ ] Security headers verified on staging (SEC-01–03).
- [ ] Mobile usability session with at least 3 Steigen residents on their own phones. Record findings.
- [ ] Accessibility spot-check: keyboard navigation, focus ring, labels, contrast (WCAG 2.1 AA target), screen reader on the listing form.
- [ ] Legal gate (`LEGAL_REVIEW_CHECKLIST.md` §3) and security gate (`SECURITY.md` §3) passed.
- [ ] No demo listing appears without the "Eksempel" badge.

## 8. Test data

- Seed scripts create fictional users ("Testbruker Ola") with `example.test` emails, never real people.
- Staging uses synthetic data only. Production data is never copied to staging or developer machines.
