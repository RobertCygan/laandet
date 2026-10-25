# Laandet — Release gates (P04-02)

**Status on 25.10.2026.** One row per gate from three sources:
- [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) §4 (G4, go/no-go);
- [`SECURITY.md`](SECURITY.md) §3 (security gate);
- [`LEGAL_REVIEW_CHECKLIST.md`](LEGAL_REVIEW_CHECKLIST.md) §3 (legal gate).

The pilot opens only when every row is ✅, or the owner has accepted a written exception. This file is
updated for the go/no-go meeting on **Friday 11.12.2026**.

Legend: ✅ met · 🟡 partly met · ❌ open · ⏳ needs the server, the domain or another owner step first

Who acts: **Developer** (code, tests, documents), **Eier** (the owner: purchases, accounts, people, sign-off),
**Lawyer** (legal review).

## Automated check

`npm run release:check` (P04-02) reports the blockers that code can find, and exits with an error while any
remain:
- `MÅ FYLLES UT FØR LANSERING` and `KONTROLLERES FØR LANSERING` markers in `legal/`;
- legal texts still stored as drafts in the database;
- demo listings in a production database;
- in production, a `MAIL_FROM` that is still the example default.

The check never prints secrets. Run it against the production database before the meeting. A clean result is
evidence for some of the rows below, not for all of them.

## G4 — go/no-go (DEVELOPMENT_ROADMAP §4)

| # | Gate | Status today | Evidence | Who acts |
|---|---|---|---|---|
| G4-1 | End-to-end journeys 1–7 (`TEST_STRATEGY.md` §5) pass in CI on the release commit | 🟡 | CI was green with 40 Playwright tests on `ecf610e`. Journey 3 («Ønskes leid» → reply with a link to the replier's own listing → request) and journey 2 with two claimants are being added in P04-02. The run must be repeated on the release commit. | Developer |
| G4-2 | All negative tests N1–N15 pass | ✅ (re-check on the release commit) | [`SECURITY_VERIFICATION.md`](SECURITY_VERIFICATION.md), section «Negative tests N1–N15». Green in CI on `ecf610e`. | Developer |
| G4-3 | Security gate met, no open high or critical vulnerabilities | 🟡 | See the security gate below. The independent review in Phase 03 found 1 high, 4 medium and 7 low issues; all are fixed with tests (`CHANGELOG.md`, Phase 03). | Developer, Eier |
| G4-4 | Legal gate met for the documents in use, no `MÅ FYLLES UT` markers | ❌ | See the legal gate below. | Lawyer, Eier |
| G4-5 | Backup restore test within the last 7 days, logged | ⏳ ❌ | [`runbooks/RESTORE.md`](runbooks/RESTORE.md) was only rehearsed locally. No real backup exists yet. The test goes in [`runbooks/RESTORE_LOG.md`](runbooks/RESTORE_LOG.md). | Eier (server), Developer |
| G4-6 | Mobile usability session done, no open blocker findings | ❌ | Script: [`beta/BRUKERTEST.md`](beta/BRUKERTEST.md). Needs residents and staging (week 50, [`BETA_PLAN.md`](BETA_PLAN.md)). | Eier, Developer |
| G4-7 | Owner has 2FA on every operational account, and at least one moderator besides the owner is named (or sole moderation with a weekly review plan is accepted) | ❌ | No operational accounts exist yet ([`runbooks/BILLING.md`](runbooks/BILLING.md)). Moderator names go into [`PILOT_SUPPORT.md`](PILOT_SUPPORT.md). | Eier |
| G4-8 | Monitoring and uptime alerts reach the owner | ⏳ ❌ | External uptime monitor on `/healthz?worker=1`: the owner creates a free account ([`runbooks/LAUNCH.md`](runbooks/LAUNCH.md) B8). Email alerts from the worker (`OPS_ALERT_EMAIL`, P04-04) are built and tested in integration tests. Both must be tested once on the server. | Eier, Developer |
| G4-9 | No demo content without an «Eksempel» label; no claim of a feature that does not work | 🟡 | Demo listings are seeded only on staging (`deploy/compose.staging.yaml`) and are labelled «Eksempel». `release:check` reports demo listings in a production database. The content pages still need a read-through against what is switched on at launch (for example rentals, if the fallback launch is used). | Developer, Eier |
| G4-10 | The owner signs off in writing (PR comment or a `DECISIONS.md` entry) | ❌ | At the meeting. | Eier |

## Security gate (SECURITY.md §3)

| # | Gate | Status today | Evidence | Who acts |
|---|---|---|---|---|
| S-1 | SEC-01 … SEC-63 verified, or an exception accepted by the owner | 🟡 | [`SECURITY_VERIFICATION.md`](SECURITY_VERIFICATION.md). Still open because they need the server or the owner: SEC-01 (HTTPS, HSTS), SEC-41 (separate environments), SEC-53 (restore), SEC-62 (server hardening), SEC-63 (owner 2FA). Partly met: SEC-30, SEC-42, SEC-60. [`ASVS_L1.md`](ASVS_L1.md): 2.1.1 is an accepted exception (6-character minimum, D-056). | Developer, Eier |
| S-2 | No open high or critical dependency findings | 🟡 | `npm audit --omit=dev --audit-level=high` passes in CI (green on `ecf610e`). OSV-Scanner is being added to CI (P04-02, SEC-60). Re-check on the release commit. | Developer |
| S-3 | Backup restore test performed and logged | ⏳ ❌ | Same as G4-5. | Eier, Developer |
| S-4 | Negative authorisation tests green | ✅ (re-check on the release commit) | 79 policy unit tests and the negative integration tests per area ([`SECURITY_VERIFICATION.md`](SECURITY_VERIFICATION.md), SEC-20). | Developer |
| S-5 | Owner account 2FA confirmed | ❌ | The owner confirms 2FA on GitHub, the hosting provider, the domain registrar, the email provider, backup storage and the Laandet admin account. | Eier |
| S-6 | Privacy notice and terms published with real controller details, no `MÅ FYLLES UT` markers | ❌ | On 25.10.2026, `brukervilkar.md` (8 lines), `personvernerklaering.md` (9) and `retningslinjer-for-tvister.md` (3) still contain markers. `release:check` lists them. | Eier (details), Lawyer |

## Legal gate (LEGAL_REVIEW_CHECKLIST.md §3)

| # | Gate | Status today | Evidence | Who acts |
|---|---|---|---|---|
| L-1 | All documents in use marked "reviewed" by a qualified Norwegian lawyer (the extended rental agreement is not used) | ❌ | [`LEGAL_REVIEW_CHECKLIST.md`](LEGAL_REVIEW_CHECKLIST.md) §1: every document is "not reviewed". No lawyer is engaged yet. | Eier, Lawyer |
| L-2 | No `MÅ FYLLES UT FØR LANSERING` or `KONTROLLERES FØR LANSERING` markers in published texts | ❌ | Same as S-6. The production deploy refuses texts with markers (`load-legal`). | Eier, Lawyer |
| L-3 | Written answers to L-01, L-03, L-04, L-05, L-06, L-07, L-08 and L-09, stored in `docs/legal-review/` | ❌ | No answers yet. | Lawyer |
| L-4 | Every published legal text has `is_draft = false` | ❌ | All texts are version `0.1.0-utkast` with status «UTKAST – ikke juridisk gjennomgått». `release:check` reports drafts in the database. | Lawyer, Developer |

**If only the rental agreement is not cleared in time:** the fallback launch
([`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) §5) opens without rentals (`rentals_open` stays off). The terms,
the privacy notice and the other texts in use must still pass L-1 to L-4.

## How to run the go/no-go meeting (Friday 11.12.2026)

Who: the owner (decides), the developer, and the named moderator(s). About 45 minutes.

1. **The day before:**
   - run `npm run release:check` against the production database;
   - check that the latest CI run on the release commit is green;
   - fill in the «Status today» column with the date and the evidence (CI run link, restore log entry, usability findings).
2. **At the meeting,** go through the tables row by row. Every ❌ or ⏳ row ends in one of three ways:
   - **met:** the evidence is shown and the row turns ✅;
   - **exception:** the owner accepts a written exception with a reason and an end date. It is recorded in `DECISIONS.md`;
   - **blocker:** no go.
3. **Decide:**
   - **go:** full pilot on 14.12.2026;
   - **go with the fallback:** without rentals (§5 of the roadmap);
   - **no-go:** with a new date.
4. **Record** the decision and the owner's written sign-off (G4-10) as a PR comment or a `DECISIONS.md` entry. Link it here.
5. **If go:** follow [`runbooks/LAUNCH.md`](runbooks/LAUNCH.md) on launch day, and set up the duty rota in [`PILOT_SUPPORT.md`](PILOT_SUPPORT.md).
