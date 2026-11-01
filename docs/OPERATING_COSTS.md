# Laandet — Operating Cost Model

**Status:** Estimate (Phase 00). **Nothing has been purchased or registered.** Every account and purchase needs the owner's explicit approval.

**Price basis:** list prices found on 25.10.2026. An AI research assistant used search excerpts of the providers'
official pages and could not open the pages directly. Items marked **UNVERIFIED** must be checked in a browser
before ordering.

**Exchange rate assumption:** 1 EUR ≈ 11.5 NOK, 1 USD ≈ 10.5 NOK (**assumption — verify**).

**VAT:** Hetzner and other EU providers charge **25 % Norwegian VAT** to customers who are not VAT-registered. A
VAT-registered business may use reverse charge. Figures below are **excl. VAT** unless stated.

## 1. Important market change in 2026

Hetzner raised cloud prices twice in 2026:
- **1 April 2026:** about +30–35 % on servers, Volumes and Object Storage.
- **15 June 2026:** new orders only; CPX/CCX up to +176 %.

Third-party sources also report that the cheapest CX/CAX plans have shown "not available" for new customers
since about September 2026 (**UNVERIFIED** on hetzner.com). The plan therefore shows two variants:
- **Variant A:** a small 4 GB server can be ordered.
- **Variant B:** only the more expensive 4 GB plan is available.

Any EU provider with comparable specs (2 vCPU, 4 GB RAM, ≥ 40 GB SSD, EU data centre) works with the
same Docker setup (D-005).

## 2. Unit prices used

| Item | Provider (candidate) | Price | Note |
|---|---|---|---|
| VPS 2 vCPU / 4 GB / 40 GB, Variant A | Hetzner CX23 | €5.99 / mo incl. IPv4 | availability for new customers **UNVERIFIED** |
| VPS 2 vCPU / 4 GB, Variant B | Hetzner CPX22 | ≈ €19.99 / mo incl. IPv4 | **UNVERIFIED** (third-party sources) |
| Server snapshots (optional) | Hetzner Backups | 20 % of server price | daily, 7 kept |
| Off-site encrypted backup | Hetzner Storage Box BX11 (1 TB) | €3.20 / mo | **UNVERIFIED** after April 2026 |
| Off-site alternative | Hetzner Object Storage | €6.49 / mo base (1 TB storage + 1 TB egress) | |
| Extra disk for media | Hetzner Volume | ≈ €0.057 / GB / mo (50 GB ≈ €2.86) | **UNVERIFIED** |
| Transactional email | Scaleway TEM | 300 free / mo, then €0.25 per 1 000 | EU company, no subscription |
| Transactional email alternative | Brevo | free up to 300 / day; Starter ≈ €7–9 / mo | EU company |
| Domain `.no` | Domeneshop | 99 kr first year, then 209 kr / yr incl. VAT | org. no. needed for an organisation; a private person can register up to 5 |
| Error monitoring (optional) | Sentry Developer | free (EU region) | Team plan $26 / mo if ever needed |
| Uptime monitoring | UptimeRobot Free | free | 50 monitors, 5-min checks, commercial use allowed |
| TLS certificates | Let's Encrypt via Caddy | free | |
| CAPTCHA (only if abuse) | Cloudflare Turnstile | free | US company → privacy assessment first |
| CI/CD | GitHub Actions + Container Registry | free tier | watch private-repo minute and storage quotas |

## 3. Usage assumptions per scenario

| Assumption | 100 users | 500 users | 2 000 users | 10 000 users |
|---|---|---|---|---|
| Active listings (≈ 1.5 per user) | 150 | 750 | 3 000 | 15 000 |
| Rentals and giveaways per month | 20 | 100 | 400 | 2 000 |
| Emails per month (≈ 6 per user) | 600 | 3 000 | 12 000 | 60 000 |
| Listing images (≈ 1.2 MB per listing incl. thumbnails) | 0.2 GB | 0.9 GB | 3.6 GB | 18 GB |
| Condition and dispute photos per year (≈ 1.5 MB per rental, kept 3 years) | 0.4 GB | 1.8 GB | 7.2 GB | 36 GB |
| Database size | < 0.2 GB | < 0.5 GB | ≈ 1 GB | ≈ 4 GB |
| Server size needed | 4 GB | 4 GB | 4 GB + 50 GB volume | 8 GB + object storage |

## 4. Monthly cost estimate (EUR, excl. VAT)

### Variant A (small server orderable)

| Cost item | Type | 100 | 500 | 2 000 | 10 000 |
|---|---|---|---|---|---|
| Server | fixed | 5.99 | 5.99 | 5.99 | ≈ 20 (8 GB class, **UNVERIFIED**) |
| Server snapshots (20 %) | fixed | 1.20 | 1.20 | 1.20 | 4.00 |
| Off-site backup (Storage Box) | fixed | 3.20 | 3.20 | 3.20 | 3.20 |
| Extra media storage | usage | – | – | 2.86 | 6.49 (object storage) |
| Email (Scaleway TEM) | usage | 0.08 | 0.68 | 2.93 | 14.93 |
| Domain (209 kr / yr ÷ 12, excl. VAT) | fixed | 1.20 | 1.20 | 1.20 | 1.20 |
| Monitoring | fixed | 0 | 0 | 0 | 0–26 (Sentry Team, optional) |
| **Total (EUR / mo)** | | **≈ 11.7** | **≈ 12.3** | **≈ 17.4** | **≈ 50–76** |
| **≈ NOK / mo excl. VAT** | | **≈ 135 kr** | **≈ 140 kr** | **≈ 200 kr** | **≈ 575–870 kr** |
| **≈ NOK / mo incl. 25 % VAT** | | **≈ 170 kr** | **≈ 175 kr** | **≈ 250 kr** | **≈ 720–1 090 kr** |

### Variant B (only the larger plan orderable)

Add about **€14 + 20 % snapshots ≈ €16.8 / mo**, roughly **190 kr excl. VAT**, to the 100–2 000-user columns. That gives
**≈ 325–390 kr / mo excl. VAT (≈ 410–490 kr incl. VAT)**.

### Fixed vs usage-dependent

- **Fixed:** server, snapshots, backup storage, domain. Together these are **> 90 % of the cost up to 2 000 users**.
- **Usage-dependent:** email volume and media storage. They only matter at 10 000 users.

### Comparison: managed stack (not recommended for the pilot)

Vercel Pro ($20) + Neon Launch (usage, ≈ $5–20) + Cloudflare R2 (≈ $0–1) + Resend ($0–20) comes to
**≈ $25–60 / mo (≈ 260–630 kr)**. That is more expensive at small scale, and most of these are US companies.

### One-time and non-infrastructure costs (not estimated here)

| Item | Note |
|---|---|
| Legal review of the documents | Get quotes from Norwegian lawyers. This is likely the largest launch cost. |
| Owner's time for operations | About 1–2 hours/week for updates, backups check and moderation in the pilot (assumption). |
| BankID / identity provider (Phase 05) | Per-verification fees through an approved broker. Not needed for the pilot. |
| Payment provider (Phase 05) | Transaction fees. Not needed for the pilot. |

## 5. Safeguards against unexpected bills

1. **Prefer fixed-price services.** The VPS, Storage Box and domain have fixed monthly prices. Hetzner includes 20 TB traffic, beyond which egress is €1/TB.
2. **Cap email sending in the app** (e.g. 2 000 per day, configurable). If a bug or spam wave hits the cap, sending stops and admins are alerted, instead of producing a bill.
3. **Upload limits** (10 MB per file, 8 per listing, re-encoded to ≈ 300 KB) keep storage growth predictable.
4. **Sentry:** free plan with spike protection, so no overage is possible on the free tier.
5. **Turn on billing alerts and monthly invoice review** for every provider that offers them. The owner reviews invoices monthly and records them on the transparency page (`/apenhet`).
6. **No auto-scaling services and no pay-per-request databases** in the pilot.
7. **Approval rule:** any new paid service or plan change needs the owner's approval, recorded in `DECISIONS.md`.

## 6. Backup and recovery (summary — full runbook in task P01-13)

| What | How | Where | Retention |
|---|---|---|---|
| PostgreSQL | nightly `pg_dump -Fc`, plus a dump before every deploy | encrypted with **restic** → Storage Box (EU) | 7 daily, 4 weekly, 6 monthly |
| Media volume | nightly restic incremental | same repository | same |
| Server | Hetzner snapshots (optional) | Hetzner | 7 days |
| Secrets | the owner's password manager (not in backups) | — | — |

- **Recovery objectives (pilot):** RPO ≤ 24 h; RTO ≤ 4 h.
- **Restore tests:**
  - Monthly: restore the latest backup into a scratch Compose project, run `db/schema-checks`-style sanity checks and open a few pages, then record the result in `docs/runbooks/RESTORE_LOG.md`.
  - **A successful restore test is a launch gate** (SEC-53).
