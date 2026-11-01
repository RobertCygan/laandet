# P04-04 — Production launch and pilot support

## GOAL
The owner can take Laandet live step by step, knows within minutes when something breaks, and has a simple
routine for the first weeks of the pilot.

## CONTEXT
- `docs/runbooks/SERVER_SETUP.md`, `DEPLOY.md`, `RESTORE.md`, `BILLING.md`. `DEVELOPMENT_ROADMAP.md` §2, §4, §5 (fallback), §7 (Christmas).

## INPUT
- The deployment files from P01-13. Owner purchases: server, domain, email provider (not made by the assistant).

## OUTPUT
1. **`docs/runbooks/LAUNCH.md`**: launch day in order, each step with a check:
   - the purchases and DNS (SPF/DKIM/DMARC);
   - server setup, the first deploy and the restore test;
   - legal texts loaded as non-drafts, the first admin with 2FA;
   - flags (`registrations_open`, then `rentals_open` or the fallback), the smoke test;
   - the announcement, and rollback.
2. **Operations alerts by email:**
   - the worker sends one email to `OPS_ALERT_EMAIL` when a job has failed three runs in a row, or has not run for three times its interval;
   - at most one alert per job every 6 hours, and one more when it recovers;
   - the email never contains personal data, only the job name, the time and the redacted error.
3. External uptime monitoring of `/healthz`, documented as an owner step (a free account the owner creates).
4. **`docs/PILOT_SUPPORT.md`**:
   - who is on duty;
   - daily checks (reports, cases, appeals, operations page, alerts) and weekly checks (costs, abuse signals, backups, feedback);
   - incident levels with response times, the Christmas freeze 18.12–04.01, and when to pause registrations or rentals.
5. **`docs/MODERERING.md`** (Norwegian, for moderators):
   - the queue, the reasons, the statement of reasons, appeals;
   - cases and grants, what never to do;
   - when to call the police or child welfare (barnevern).

## CONSTRAINTS
- The assistant never buys, registers or creates accounts. Steps that need them are marked «Eier».
- Alerts never contain message text, email addresses or names.

## TESTS
1. Integration: an alert is queued after the third failure in a row, not again within 6 hours, and a recovery notice follows. It contains no personal data. Nothing is sent when `OPS_ALERT_EMAIL` is empty.
2. Review: LAUNCH.md and PILOT_SUPPORT.md are followed once on staging when it exists.
