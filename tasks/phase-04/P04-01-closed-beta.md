# P04-01 — Closed beta with residents and a feedback loop

## GOAL
10–20 Steigen residents can try Laandet on staging before the pilot, and every problem they find reaches the
owner in one place.

## CONTEXT
- `docs/DEVELOPMENT_ROADMAP.md` §2 (week 50) and §4. `deploy/Caddyfile` (staging already needs a password).
- Staging seeds labelled demo listings (`compose.staging.yaml`).

## INPUT
- The application after Phase 03. Staging needs a server and domain, which the owner buys (`runbooks/BILLING.md`).

## OUTPUT
1. **«Gi tilbakemelding»**, linked from the footer and the account page, for signed-in users:
   - fields: what it is about (error / suggestion / other), up to 2 000 characters of text, and the page it came from (filled in automatically);
   - stored in `feedback`, limited to 10 a day per person;
   - staff see the list at `/admin/tilbakemeldinger`, newest first, and mark items as handled. Admins and moderators both have access;
   - kept for 12 months (retention job).
2. **Staging banner** on every page when `APP_ENV=staging`: «Testversjon. Alt du legger inn her kan bli slettet. Ikke inngå ekte avtaler her.»
3. **`docs/BETA_PLAN.md`** (owner): who to invite, how to share the staging password, what to test each day, how feedback is triaged, and that staging data is wiped before launch.
4. **`docs/beta/TESTERVEILEDNING.md`** (Norwegian, for testers): how to sign in, what to try, how to give feedback, and what not to do (no real money, no real items of value).

## CONSTRAINTS
- No new third-party tools: feedback stays in our own database.
- The feedback text is personal data. It is in the data export and in PRIVACY §5.

## TESTS
1. Integration: feedback is saved, the 11th in a day is refused, a visitor cannot send it, a member cannot list it, staff can mark it handled (audited), the retention job removes items older than 12 months.
2. E2E: a member sends feedback from the footer link and staff see it (390 px, axe).
