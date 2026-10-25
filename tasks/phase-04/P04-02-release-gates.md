# P04-02 — Release gates

## GOAL
At the go/no-go meeting on Friday 11.12.2026, every gate in `DEVELOPMENT_ROADMAP.md` §4 has a clear status with
evidence, and everything that code can check is checked by a command.

## CONTEXT
- `DEVELOPMENT_ROADMAP.md` §4 (G4), `SECURITY.md` §3, `LEGAL_REVIEW_CHECKLIST.md` §3, `TEST_STRATEGY.md` §5.
- `docs/SECURITY_VERIFICATION.md`, `docs/ASVS_L1.md`.

## INPUT
- The application and documents after Phase 03.

## OUTPUT
1. **`docs/RELEASE_GATES.md`**: one row per gate (G4 1–10, security gate 1–6, legal gate 1–4), each with its status, the evidence and who acts. It is updated for the meeting.
2. **`npm run release:check`**, which reports and exits non-zero while any blocker remains:
   - `MÅ FYLLES UT` or `KONTROLLERES FØR LANSERING` markers in `legal/`;
   - legal texts still marked as drafts in the database;
   - demo listings present in a production database;
   - with `APP_ENV=production`: `MAIL_FROM` is not the example default (the other production settings are already enforced at start-up).
3. **End-to-end journeys missing from CI** (`TEST_STRATEGY.md` §5):
   - journey 3: «Ønskes leid» → a reply with a link to the replier's own listing → a request on that listing;
   - journey 2 with two claimants: the one not chosen is told «ikke valgt».
4. **OSV-Scanner in CI** (SEC-60), next to `npm audit`.
5. **«Vis passord»** on every password field (ASVS 2.1.12; it goes with the shorter minimum of D-056).
6. **`docs/beta/BRUKERTEST.md`** (Norwegian): a 30-minute mobile usability session script. It has five tasks, what to observe, how to rate findings, and a results table.

## CONSTRAINTS
- The check never prints secrets; it only says whether a setting is present.
- Nothing is marked as met that has not been checked.

## TESTS
1. Unit: the marker scan finds markers in a fixture and passes a clean one.
2. E2E: journeys 2 (two claimants) and 3; «Vis passord» changes the field type and has an accessible name.
3. CI: the OSV-Scanner job runs on every push.
