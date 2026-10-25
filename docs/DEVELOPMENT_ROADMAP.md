# Laandet — Development Roadmap to a Safe Pilot

**Status:** Planned (Phase 00), awaiting owner approval.
**Today:** Sunday 25.10.2026. **Target:** public pilot in Steigen on **Monday 14.12.2026** (ISO week 51).
**Available time:** 7 working weeks.

## 1. Honest assessment

The full master specification needs about **9–12 weeks** of focused work for one developer with an AI
assistant. Seven weeks are available. The plan below reaches 14.12 only if:

1. The scope is held to the **MVP "must" list** (§3).
2. The owner makes the decisions in §6 during **week 44**.
3. **A lawyer is engaged in week 44** and returns comments by **04.12.2026**. Legal review is the biggest
   external dependency, and no code can speed it up.
4. A **fallback launch** (§5) is accepted in advance, in case the rental agreements are not legally cleared in time.

## 2. Timeline

| Week | Dates | Phase | Main deliverables | Gate |
|---|---|---|---|---|
| 44 | 26.10–01.11 | 00 → 01 | Owner reviews Phase 00 and decides §6. Legal package sent to a lawyer. Accounts approved (domain, VPS, email). **P01-01 scaffold, P01-02 design system, P01-03 i18n, P01-04 database** | G0: Phase 00 approved |
| 45 | 02.11–08.11 | 01 | **P01-05 auth, P01-06 authorisation and audit, P01-07 profiles, P01-08 listings, P01-09 uploads** | |
| 46 | 09.11–15.11 | 01 | **P01-10 explore and search, P01-11 content and legal pages, P01-12 reporting (minimal), P01-13 staging deploy and backups.** Demo to owner on staging. | **G1:** Phase 01 accepted |
| 47 | 16.11–22.11 | 02 | Messaging, rental requests, booking state machine, giveaway claims, in-app notifications and email outbox | |
| 48 | 23.11–29.11 | 02 | Agreement generation and acceptance, handover and return condition reports with photos, reminders (worker) | **G2:** Phase 02 accepted |
| 49 | 30.11–06.12 | 03 | Disputes, reviews, moderation and appeals, admin panel, data export, legal texts updated with the lawyer's comments (due **04.12**) | **G3:** Phase 03 accepted |
| 50 | 07.12–13.12 | 04 | Closed beta with 10–20 Steigen residents, security review, restore test, mobile usability session, bug fixes, production deploy. **Go/no-go meeting Friday 11.12.** | **G4:** go/no-go |
| 51 | **14.12** | Pilot | Public pilot opens (or the fallback scope, §5) | |
| 51–02 | 14.12–10.01 | Pilot support | Fixes, moderation, weekly check of costs and abuse signals. No new features over Christmas. | |

## 3. MVP scope

### Must (pilot cannot open without these)
- Registration, email verification, sign-in/out, password reset, account deletion request (P01-05)
- Profiles with real data only (P01-07)
- Listings: Leies ut (category A only), Ønskes leid, Gis bort, with photos and delivery options (P01-08/09)
- Explore and search with filters; demo listings labelled (P01-10)
- Messaging tied to listings and bookings; block and report
- Rental request → accept/decline → agreement A → both accept → handover report → return report → complete
- Gis bort claim → select → transfer confirmation
- «Meld fra om et problem»: dispute workflow steps 1–3, and step 4 with staff facilitation
- Reporting and basic moderation with statement of reasons and appeal
- Two-sided double-blind reviews
- Legal pages (reviewed), «Støtt Laandet» (without link until a campaign exists), «Slik fungerer det», «Trygghet»
- Norwegian and English UI
- Security controls SEC-01…SEC-63, backups with a tested restore

### Should (included if on schedule)
- Saved listings ("Lagre")
- Data export ("Last ned mine data"). Fallback: manual export on email request.
- Passkeys
- Payment-link warning heuristic in messages
- Transparency page with real figures (needs real invoices anyway)

### Won't in the pilot (Phase 05 or later)
- Category B rentals (> 5 000 kr), BankID, integrated payments or deposits, insurance
- Business users, promoted listings, commissions
- Maps and distances, native apps, push notifications, SMS
- Real-time chat (polling is enough)

## 4. Release acceptance criteria (G4 go/no-go)

The pilot opens only if **every** item is true:

1. ✅ End-to-end journeys 1–7 in `TEST_STRATEGY.md` §5 pass in CI on the release commit.
2. ✅ All mandatory negative tests N1–N15 pass.
3. ✅ Security gate (`SECURITY.md` §3) met. No open high or critical vulnerabilities.
4. ✅ Legal gate (`LEGAL_REVIEW_CHECKLIST.md` §3) met for the documents in use. No `MÅ FYLLES UT` markers.
5. ✅ Backup restore test performed within the last 7 days and logged.
6. ✅ Mobile usability session done, with no open blocker findings.
7. ✅ The owner has 2FA on every operational account, and at least one moderator besides the owner is named (or the owner accepts sole moderation and a weekly review plan).
8. ✅ Monitoring and uptime alerts reach the owner.
9. ✅ No demo content without an "Eksempel" label, and no claim of a feature that does not work.
10. ✅ The owner signs off in writing (PR comment or `DECISIONS.md` entry).

## 5. Fallback launch (if G4 fails only on the rental agreements' legal review)

Open the pilot on 14.12 with:
- browsing, accounts, profiles, listings (all three types), messaging, reports and moderation, and Gis bort with transfer confirmation;
- **«Leies ut» listings visible, but the request button replaced by** «Utleie åpner snart – vi venter på
  juridisk gjennomgang av leieavtalen». The flag `rentals_open` (off) keeps the agreement flow closed.

When the review is done, the rental flow switches on without a new deploy. The terms and privacy notice must
still be reviewed for the fallback launch.

## 6. Owner decisions needed in week 44

| # | Decision | Ref | Recommendation |
|---|---|---|---|
| 1 | Confirm two languages (nb + en); are **English legal translations** wanted at launch? | D-001 | Yes to both, marked informational |
| 2 | Approve stack (Next.js, Drizzle, Better Auth, PostgreSQL) | D-004 | Approve |
| 3 | Approve hosting model and **buy a server** (provider + plan) | D-005, `OPERATING_COSTS.md` | One EU VPS (Hetzner if orderable) |
| 4 | Choose and create an **email provider** account | D-008 | Scaleway TEM or Brevo |
| 5 | **Domain** (e.g. `laandet.no`: check availability) and who registers it | — | Register in the operating entity's name |
| 6 | **Legal entity details** for terms and privacy (name, org.nr., address, contact email) | L-01 | — |
| 7 | **Engage a Norwegian lawyer** and send the package | `LEGAL_REVIEW_CHECKLIST.md` | Week 44 |
| 8 | Paid rental of trailers, bicycles, kayaks: pause until the DPI question is answered? | D-028 | Pause and ask lawyer or Skatteetaten |
| 9 | Show category B items as non-bookable previews? | D-011 | No (keep off) |
| 10 | Confirm the locality list | D-029 | — |
| 11 | Who moderates during the pilot (names, 2FA)? | AUTH_MODEL §6 | Owner + 1 trusted person |
| 12 | Create a dedicated repository `laandet`? | D-002 | Yes, before Phase 01 starts |
| 13 | Accept the fallback launch plan (§5) | — | Yes |

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Legal review late | high | high | engage in week 44; fallback launch §5 |
| Scope creep | medium | high | must/should/won't list; changes go through `DECISIONS.md` |
| Hosting plan unavailable or more expensive | medium | low | provider-agnostic Docker setup; Variant B budget |
| Email deliverability (verification mails in spam) | medium | high | SPF/DKIM/DMARC on the domain in week 44; test with Gmail, Outlook and Norwegian ISPs |
| Too few real listings at launch | medium | medium | owner recruits 15–30 founding listers during the closed beta; demo listings (labelled) until then |
| Abuse or scam attempts | medium | medium | rate limits, reporting, category A cap, education texts |
| Single developer unavailable | medium | high | everything documented in the repository; tasks are self-contained for any AI assistant or developer |
| Christmas period support | high | medium | no feature releases 18.12–04.01; owner checks reports daily |

## 8. After the pilot (Phase 05 candidates, only with explicit approval)

BankID and category B, a payment provider with deposit authorisation, insurance partner, business accounts,
other municipalities, maps, native apps.
