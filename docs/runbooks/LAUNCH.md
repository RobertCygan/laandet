# Runbook — Launch (P04-04)

**Status:** not executed. Nothing in this runbook has been done on a real server. The assistant never buys, registers
or creates accounts; those steps are marked **«Eier»**.

Follow the steps in order. Each step ends with a **check**. Do not go on until the check passes. Write the date and
your initials after each check, in a copy of this file or in the launch PR.

Target: the public pilot opens on **Monday 14.12.2026**, after a **go** (or **go with the fallback**) at the go/no-go
meeting on Friday 11.12.2026 ([`../RELEASE_GATES.md`](../RELEASE_GATES.md)).

## A. Weeks before launch

### A1. «Eier» Purchases and accounts
Server, domain, email provider and off-site backup storage, as approved in [`BILLING.md`](BILLING.md). Record each
purchase in `DECISIONS.md`. Turn on 2FA and billing alerts everywhere ([`SERVER_SETUP.md`](SERVER_SETUP.md) §0).

**Check:** every account has 2FA (security gate S-5). The owner's password manager holds every login.

### A2. «Eier» DNS and email authentication
Set the A/AAAA records for the domain and `staging.<domain>`, and the **SPF**, **DKIM** and **DMARC** records from
the email provider ([`SERVER_SETUP.md`](SERVER_SETUP.md) §1).

**Check:**
- `dig +short <domain>` and `dig +short staging.<domain>` show the server;
- `dig +short TXT _dmarc.<domain>` shows the DMARC record;
- a test email from the provider reaches a Gmail, an Outlook and a Norwegian ISP address in the **inbox**, not in spam.

### A3. Server setup
Follow [`SERVER_SETUP.md`](SERVER_SETUP.md) §2–8: hardening, Docker, the deploy user, secrets, the image registry,
Caddy with the staging password, and backups.

**Check:** every item in [`SERVER_SETUP.md`](SERVER_SETUP.md) §10 «Done when».

### A4. Staging and the closed beta
Deploy to staging ([`DEPLOY.md`](DEPLOY.md), tag `laandet-vX.Y.Z-staging`) and run the beta ([`../BETA_PLAN.md`](../BETA_PLAN.md)).

**Check:**
- staging answers only with the password and shows the «Testversjon» banner;
- the beta findings are triaged.

### A5. Restore test
Run the restore test on a real backup ([`RESTORE.md`](RESTORE.md) §1) and log it in [`RESTORE_LOG.md`](RESTORE_LOG.md).

**Check:** a logged, successful test **no more than 7 days before launch** (G4-5, S-3). If it is older than 7 days
on launch day, run it again.

### A6. Legal texts
After the lawyer's review:
- the controller details are filled in and every `MÅ FYLLES UT FØR LANSERING` and `KONTROLLERES FØR LANSERING` marker is removed;
- the `status` line no longer says «UTKAST»;
- the version is raised (for example `1.0.0`).

The production deploy loads the texts and refuses drafts ([`DEPLOY.md`](DEPLOY.md)). Staging can still load drafts
with `--allow-draft`.

**Check:** legal gate L-1 to L-4 in [`../RELEASE_GATES.md`](../RELEASE_GATES.md).

## B. The days before launch

### B1. Production settings
In `/opt/laandet/production/secrets/app.env` ([`SERVER_SETUP.md`](SERVER_SETUP.md) §5):
- `APP_ENV=production` and an `https://` `APP_URL`;
- the operator details;
- `SMTP_URL`, and a real `MAIL_FROM` on the authenticated domain;
- `OPS_ALERT_EMAIL` set to the owner's address. The worker then emails when a job has failed three runs in a row or has not run for three times its interval. It sends at most one alert per job every 6 hours, plus one when the job recovers. Alerts never contain personal data.

**Check:** production refuses to start without the required settings. That is intended, so a successful start is
the check.

### B2. Release check
Run `npm run release:check` against the production database (P04-02; how to run it on the server is in
`app/README.md`). It reports:
- legal markers;
- legal texts still stored as drafts;
- demo listings in the production database;
- a `MAIL_FROM` that is still the example default.

**Check:** the command ends without blockers.

### B3. First production deploy (the evening before)
Tag `laandet-vX.Y.Z` and approve the deploy in GitHub Actions ([`DEPLOY.md`](DEPLOY.md)). Production gets no demo
listings.

**Check:** the checks after a deploy in [`DEPLOY.md`](DEPLOY.md):
- `/healthz` answers `{"db":"ok","media":"ok"}`;
- the security headers including HSTS are present;
- `psql` from outside cannot connect.

### B4. «Eier» First admin and the moderators
1. The owner registers on production with their own email and verifies it. Registration is still open at this point.
2. On the server, give the owner the admin role ([`DEPLOY.md`](DEPLOY.md), «Grant a staff role», `--role admin`).
3. The owner signs in again and sets up two-factor login at `/konto/tofaktor`, and stores the backup codes offline.
4. Repeat for each moderator with `--role moderator`.

**Check:**
- `/admin` opens only after the TOTP code;
- the moderators are named in [`../PILOT_SUPPORT.md`](../PILOT_SUPPORT.md) (G4-7).

### B5. Close registrations until the announcement
Sign in as admin. In `/admin/flagg`, switch `registrations_open` **off** with a
reason («Åpner ved lansering 14.12.2026»).

**Check:** sending the form on `/registrer` gives «Denne funksjonen er midlertidig stengt.»

### B6. Rentals or the fallback
- **Full launch** (the rental agreement is cleared): switch `rentals_open` **on** in `/admin/flagg`, with a reason.
- **Fallback launch** ([`../DEVELOPMENT_ROADMAP.md`](../DEVELOPMENT_ROADMAP.md) §5): leave `rentals_open` **off**. «Leies ut» listings stay visible and show that rentals open soon.

**Check:** on a «Leies ut» listing, «Send forespørsel» is shown (full launch) or not shown (fallback). This matches the
go/no-go decision.

### B7. Smoke test on production
1. Open the home page, «Utforsk», a legal page and «Åpenhet» on a phone. The legal pages must show **no** draft label.
2. Request a password reset for the owner's account, and check that the email arrives within a minute.
3. Open `/admin/tall`: every worker job has run recently, and no email has failed.

**Check:** all three pass.

### B8. «Eier» External uptime monitor
Create a free account with an uptime service (for example UptimeRobot, D-027). Monitor `https://<domain>/healthz?worker=1`
every 5 minutes. With `?worker=1` it also fails when the worker has run no job for 15 minutes, which the worker's own
emails cannot report. Send alerts to the owner's email or phone. The owner creates the account; it is not created for
them.

**Check:** the monitor shows «up», and a test alert reaches the owner (G4-8).

## C. Launch day (Monday 14.12.2026)

### C1. Open registrations
In `/admin/flagg`, switch `registrations_open` **on**, with a reason («Pilot åpnet»).

**Check:** a new account can be created and verified. Use a second address of the owner's and delete the account afterwards.

### C2. «Eier» Announcement
Announce the pilot in the channels the owner chooses (Eier fyller inn). Link to «Slik fungerer det» and «Trygghet».

**Check:** the link in the announcement opens the production site.

### C3. The first hours
Follow the daily checks in [`../PILOT_SUPPORT.md`](../PILOT_SUPPORT.md) every two hours on launch day:
- reports;
- cases;
- `/admin/tall`;
- operations alerts;
- feedback.

**Check:** nothing is left unread at the end of the day.

## D. Rollback and pausing

Choose the smallest step that stops the problem:

| Problem | Step |
|---|---|
| Abuse or a flood of sign-ups | `/admin/flagg`: `registrations_open` off (and `listings_open` off if needed), with a reason. |
| A problem in the rental flow | `/admin/flagg`: `rentals_open` off. Bookings already under way can still be finished. |
| A bad release (errors, broken pages) | Manual rollback to the previous release ([`DEPLOY.md`](DEPLOY.md), «Manual rollback»). |
| A migration damaged data | Restore the pre-deploy dump ([`RESTORE.md`](RESTORE.md) §3). Writes made after the dump are lost, so announce downtime first. |
| The server is lost | Disaster recovery ([`RESTORE.md`](RESTORE.md) §2). |
| Suspected personal data breach | Follow [`../PRIVACY.md`](../PRIVACY.md) §9 and record it in [`BREACH_LOG.md`](BREACH_LOG.md). Datatilsynet must be told within 72 hours if there is a risk to people. |

After any rollback or pause:
- write a short note in `DECISIONS.md` or the incident log ([`../PILOT_SUPPORT.md`](../PILOT_SUPPORT.md));
- if the pause lasts more than a few hours, tell users in the announcement channel. There is no site-wide notice feature.
