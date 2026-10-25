# Billing — providers, plans and alerts

**Status (25.10.2026): nothing has been purchased, ordered or registered.** Every item below requires
the owner's explicit approval, is bought by the owner with the owner's own accounts, and is recorded
in `docs/DECISIONS.md` (date, provider, plan, price, who approved). The developer never buys or
registers anything.

Prices are the Phase 00 estimates from `docs/OPERATING_COSTS.md` (list prices found on 25.10.2026,
excl. VAT unless stated). Items marked **UNVERIFIED** there must be checked on the provider's own site
before ordering. Update this table with the **actual** plan and price when something is bought.

| Service | Candidate provider and plan | Estimated monthly cost | Needed for | Status | Billing alert / invoice goes to |
|---|---|---|---|---|---|
| VPS 2 vCPU / 4 GB / ≥ 40 GB, EU | Hetzner CX23 (Variant A) — or CPX22 / any comparable EU provider (Variant B) | €5.99 (A, availability **UNVERIFIED**) / ≈ €19.99 (B, **UNVERIFIED**) | staging + production (D-005) | not purchased | owner — MÅ FYLLES UT |
| Server snapshots (optional) | Hetzner Backups | 20 % of server price | extra safety, not required | not purchased | owner |
| Off-site backup storage, EU | Hetzner Storage Box BX11 (1 TB) — or Hetzner Object Storage | €3.20 (**UNVERIFIED** after April 2026) / €6.49 | nightly restic backups (SEC-53) | not purchased | owner |
| Domain | `.no` at Domeneshop | 99 kr first year, then 209 kr / year incl. VAT | site, TLS, email sender | not registered | owner |
| Transactional email, EU | Scaleway TEM — or Brevo free tier | ≈ €0.08–3 at pilot volume (TEM, usage-based) / €0 (Brevo free, 300 per day) | sign-up, password reset, notices (D-008) | no account | owner |
| TLS certificates | Let's Encrypt via Caddy | free | HTTPS | — | ACME notices to `ACME_EMAIL` |
| Uptime monitoring (optional) | UptimeRobot Free | free | `/healthz` alerts (D-027) | no account | owner |
| Error monitoring (optional) | Sentry Developer, EU region | free | errors without personal data (D-027) | no account | owner |
| Image registry + CI | GitHub Container Registry + Actions | free tier | CI, image build and deploy | free tier of the existing GitHub account; the Laandet workflows are in the repository | owner (GitHub billing) |

Notes:
- **GitHub Packages:** for a private repository, image storage counts against the account's free
  packages quota. Check the current quota in GitHub billing settings before the first push, or make the
  `laandet-app` package public (it contains no secrets). The deploy keeps only the current and previous
  image on the server; old tags in GHCR can be deleted by hand.
- **Safeguards** (OPERATING_COSTS.md §5): fixed-price plans where possible, billing alerts turned on for
  every provider that offers them, no auto-scaling or pay-per-request services, monthly invoice review by
  the owner, and published figures on `/apenhet` only after they are checked.
- **Approval record:** add a line to `DECISIONS.md` for every purchase and every new account.
