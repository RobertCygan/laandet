# P01-13 — Staging and production deployment, backups and runbooks

## GOAL
A reproducible, low-cost deployment on one EU server with a staging environment, nightly encrypted off-site
backups, a **tested restore**, and runbooks that another person can follow.

## CONTEXT
- Decisions: D-005, D-008, D-027.
- Costs: `OPERATING_COSTS.md`.
- Requirements: SEC-01, SEC-40…43, SEC-53, SEC-61…63.
- **Blocked until the owner has approved and bought the server and domain.**

## INPUT
- Docker image built from `laandet/app`.
- Compose services `app`, `worker`, `db` (postgres:17) and `caddy`.
- Off-site storage (Storage Box or object storage).
- restic.

## OUTPUT
1. **`laandet/app/Dockerfile`:**
   - multi-stage build with a pinned base image digest;
   - Next.js `output: 'standalone'`;
   - runs as a non-root user with a read-only root filesystem;
   - writable volumes only for `/data/media` and `/tmp`.
2. **`laandet/deploy/compose.yaml`** (production) and **`compose.staging.yaml`**:
   - separate projects, networks, volumes and secrets;
   - Postgres is not exposed to the host network.
3. **`laandet/deploy/Caddyfile`:**
   - automatic TLS;
   - HSTS;
   - security headers duplicated from the app as a fallback;
   - `request_body max_size 12MB`;
   - staging basic auth and `X-Robots-Tag: noindex`.
4. **`.github/workflows/laandet-deploy.yml`:**
   - on tag `laandet-v*`: build, push to GHCR, then deploy over SSH with a restricted deploy user;
   - steps: pre-deploy `pg_dump`, `migrate`, `up -d`, `/healthz` check, automatic rollback to the previous tag on failure.
5. **`laandet/deploy/backup/`:**
   - scripts `backup.sh` (pg_dump `-Fc` plus restic for the media volume, retention `--keep-daily 7 --keep-weekly 4 --keep-monthly 6`) and `restore.sh`;
   - systemd timer units;
   - the restic password is kept in the owner's password manager and in a root-only file.
6. **Runbooks in `laandet/docs/runbooks/`:**

   | File | Contents |
   |---|---|
   | `SERVER_SETUP.md` | hardening checklist SEC-62: SSH keys, firewall, unattended upgrades, fail2ban; DNS records SPF/DKIM/DMARC for the email domain |
   | `DEPLOY.md` | deploy and rollback steps |
   | `RESTORE.md` | step-by-step restore into a scratch project |
   | `RESTORE_LOG.md` | table: date, backup id, result, duration, by whom |
   | `ACCESS_LOG.md` | manual log of direct database access to personal data |
   | `BREACH_LOG.md` | breach register template (`PRIVACY.md` §9) |
   | `BILLING.md` | provider list, plan, monthly cost and where alerts go |

## CONSTRAINTS
- No production data in staging, ever.
- No secrets in the repository or in images.
- Every purchase or account creation needs owner approval, recorded in `DECISIONS.md`.

## TESTS (acceptance criteria)
1. A tag `laandet-v0.1.0-staging` deploys to staging, and `/healthz` returns 200 over HTTPS.
2. `curl -I https://staging.<domain>` shows HSTS, CSP, `nosniff`, `frame-ancestors 'none'` and `X-Robots-Tag: noindex`.
3. `docker inspect` shows the app running as a non-root user, and `psql` from outside the server cannot connect.
4. **The first restore test is executed:** restore last night's backup into a scratch project, check that row counts match and that a listing with images renders, and record the result in `RESTORE_LOG.md`. Report the actual duration.
5. A deliberately failing deploy (bad image) rolls back automatically, and staging stays up.
