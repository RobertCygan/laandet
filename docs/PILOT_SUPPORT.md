# Laandet — Pilot support (P04-04)

**For the owner and the people on duty during the pilot (from 14.12.2026).** Status: planned; not used yet.
Response times below are **proposals**. The owner confirms them before launch.

Moderators also read [`MODERERING.md`](MODERERING.md) (Norwegian). Launch-day steps are in [`runbooks/LAUNCH.md`](runbooks/LAUNCH.md).

## 1. Duty rota

At least two people, so that nobody handles their own case and appeals can go to someone else
([`AUTH_MODEL.md`](AUTH_MODEL.md) §4). Everyone on the rota has a staff account with two-factor login.

| Week | Dates | On duty | Backup | Notes |
|---|---|---|---|---|
| 51 | 14.12–20.12 | Eier fyller inn | Eier fyller inn | Launch week: checks every two hours on 14.12 |
| 52 | 21.12–27.12 | Eier fyller inn | Eier fyller inn | Christmas freeze |
| 53 | 28.12–03.01 | Eier fyller inn | Eier fyller inn | Christmas freeze |
| 01 | 04.01–10.01 | Eier fyller inn | Eier fyller inn | Freeze ends 04.01 |

If only the owner can moderate, the owner accepts sole moderation and a weekly review plan in writing (gate G4-7 in
[`RELEASE_GATES.md`](RELEASE_GATES.md)).

## 2. Daily checks (about 15 minutes)

| Where | What to look for | Proposed target |
|---|---|---|
| `/admin/rapporter` | Open reports. Reports about safety, threats or fraud first. | first look within 24 hours |
| `/admin/saker` | Cases where a party asked for help. «Gjenstanden er ikke levert tilbake» and «Utstyret var utrygt» first. | first staff answer within 5 working days ([`DISPUTE_POLICY.md`](DISPUTE_POLICY.md)); urgent categories the same day |
| `/admin/klager` | Open appeals. Someone other than the original decider handles them where possible. | within 7 days |
| `/admin/tall` | Worker jobs that are late or failing, emails that failed, rate-limit hits | every day |
| Email | Operations alerts from the worker (`OPS_ALERT_EMAIL`) and from the uptime monitor | at once (§4) |
| `/admin/tilbakemeldinger` | New feedback. Mark each item as handled when it has been read and sorted. | every day |

## 3. Weekly checks (about 30 minutes, the owner)

- **Costs:** compare the providers' invoices with the budget ([`OPERATING_COSTS.md`](OPERATING_COSTS.md)). When a month is complete, enter the real figures at `/admin/apenhet`. They then appear on the public page «Åpenhet».
- **Abuse signals** on `/admin/tall` and in the queue:
  - rate-limit hits;
  - the same person reported again and again;
  - new accounts with many listings;
  - messages with payment links.
- **Staff access:** read the security log (`/admin/sikkerhet`) for the week's case grants and staff views. Every grant has a reason that fits a real case.
- **Backups:** the last nightly backup succeeded (`journalctl -u laandet-backup@production -n 20` on the server). Once a month, a restore test ([`runbooks/RESTORE.md`](runbooks/RESTORE.md)) logged in [`runbooks/RESTORE_LOG.md`](runbooks/RESTORE_LOG.md).
- **Feedback themes:** what came up more than once. Turn it into a task or a decision.
- **Updates:** Dependabot pull requests and the CI dependency checks, handled by the developer.

## 4. Incident levels

| Level | Examples | Proposed response | Who |
|---|---|---|---|
| **1 — critical** | The site is down; personal data may be exposed; a threat to someone's safety; the wrong person sees private data | start within 1 hour in waking hours; pause features (§6); suspected breach → §7 | on duty + owner |
| **2 — serious** | A main flow is broken (registration, publishing, messages, rentals, giveaways); emails do not arrive; a worker job keeps failing | the same day | on duty, developer |
| **3 — minor** | A page looks wrong; a text is unclear; one person has a problem that has a workaround | next working day | developer |
| **4 — wish** | Suggestions and ideas | weekly review | owner |

Write every level 1 and 2 incident in the log below: what happened, when it was found, what was done, and when it
was fixed.

## 5. Christmas freeze (18.12.2026–04.01.2027)

- **No feature releases.** Only fixes for level 1 and 2 incidents, each tested in CI and deployed to staging first.
- The owner checks reports and cases **every day**, including holidays ([`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) §7).
- If nobody can check for a day, switch `registrations_open` off beforehand, so the community stays small and known.

## 6. When to pause

Flags are switched at `/admin/flagg`. Each switch needs a reason and is logged.

| Situation | Pause |
|---|---|
| Spam or fake accounts in numbers | `registrations_open` off |
| Many unsafe or prohibited listings | `listings_open` off; handle the queue |
| A problem in agreements, condition reports or the rental flow | `rentals_open` off. Rentals already under way can be finished. |
| A bad release | roll back ([`runbooks/DEPLOY.md`](runbooks/DEPLOY.md), «Manual rollback») |
| Suspected data breach | §7, and pause whatever exposes the data |

Switch the flag back on, with a reason, when the cause is fixed.

## 7. Personal data breach

Follow [`PRIVACY.md`](PRIVACY.md) §9:
1. contain;
2. assess within 24 hours;
3. notify Datatilsynet within 72 hours if there is a risk to people's rights and freedoms;
4. inform the users affected if the risk is high;
5. record every breach in [`runbooks/BREACH_LOG.md`](runbooks/BREACH_LOG.md), including those not notified.

The owner decides on notification. The lawyer is told.

## 8. Safety and the police

If someone is in danger: 112 (police), 113 (ambulance), 110 (fire). Laandet is not an emergency service.
Possible theft or fraud: the police on 02800 or politiet.no. How moderators handle these cases is in
[`MODERERING.md`](MODERERING.md).

## 9. Incident log

| # | Found (date, time) | Level | What happened | What was done | Fixed (date) | By |
|---|---|---|---|---|---|---|
| | | | | | | |
