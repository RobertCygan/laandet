# Runbook — Server setup (P01-13, SEC-62, SEC-63)

**Status:** not executed. **Blocked until the owner has approved and bought the server and the domain**
(`BILLING.md`, DECISIONS D-005). Record each purchase or new account in `DECISIONS.md`.

Target: one Linux VPS in the EU/EEA, at least 2 vCPU / 4 GB RAM / 40 GB SSD, Debian 12 or Ubuntu 24.04
LTS. Commands are run as root unless stated. Replace `laandet.example.invalid` with the real domain.

## 0. Accounts (owner)

- [ ] GitHub, hosting, domain registrar, email provider and backup storage accounts all use 2FA (SEC-63).
- [ ] Billing alerts on for every provider that offers them; invoices go to the owner (`BILLING.md`).

## 1. DNS

| Record | Name | Value |
|---|---|---|
| A / AAAA | `laandet.example.invalid` | server IPv4 / IPv6 |
| A / AAAA | `staging.laandet.example.invalid` | same server |
| CAA (optional) | `laandet.example.invalid` | `0 issue "letsencrypt.org"` |

Email domain (the domain in `MAIL_FROM`), from the chosen provider's instructions (D-008):
- [ ] **SPF** TXT record including the provider, ending in `-all` or `~all`.
- [ ] **DKIM** records exactly as the provider gives them.
- [ ] **DMARC** TXT `_dmarc` — start with `v=DMARC1; p=none; rua=mailto:<owner address>`, move to
      `p=quarantine` once reports look clean.

## 2. Base hardening (SEC-62)

```sh
apt update && apt full-upgrade -y
apt install -y unattended-upgrades fail2ban ufw curl ca-certificates gnupg restic openssl
dpkg-reconfigure -plow unattended-upgrades          # security updates automatically
timedatectl set-timezone Europe/Oslo
```

- [ ] Create a personal admin user with sudo and an SSH key; test login in a second terminal.
- [ ] `/etc/ssh/sshd_config.d/10-laandet.conf`:
      `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`,
      `AllowUsers <admin> laandet-deploy` → `systemctl reload ssh`.
- [ ] fail2ban: enable the `sshd` jail (`/etc/fail2ban/jail.d/sshd.local`: `[sshd] enabled = true`).
- [ ] Firewall: `ufw default deny incoming && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable`.
      Note: Docker publishes ports past ufw. Only Caddy publishes ports (80/443); PostgreSQL and the app
      publish none. Check with `ss -tlnp` after the first deploy: only 22, 80 and 443 listen publicly.
- [ ] If the provider offers a cloud firewall, mirror the same rules there.

## 3. Docker

Install Docker Engine and the Compose plugin from Docker's official apt repository
(docs.docker.com/engine/install). Then `/etc/docker/daemon.json`:

```json
{
  "log-driver": "local",
  "log-opts": { "max-size": "20m", "max-file": "10" },
  "live-restore": true
}
```

`systemctl restart docker`. (Docker rotates by size, not by days; this keeps roughly the last weeks of
logs at pilot traffic — ARCHITECTURE.md §7 asks for about 30 days.)

## 4. Deploy user and directories

```sh
groupadd --system laandet-deploy
useradd --create-home --shell /bin/bash --gid laandet-deploy --groups docker laandet-deploy
install -d -o root -g root -m 0755 /opt/laandet /opt/laandet/bin
for env in production staging; do
  install -d -o root -g laandet-deploy -m 0770 /opt/laandet/$env /opt/laandet/$env/releases
  install -d -o root -g laandet-deploy -m 0750 /opt/laandet/$env/secrets
  install -d -o root -g laandet-deploy -m 0770 /var/backups/laandet/$env /var/backups/laandet/$env/predeploy
done
install -d -o root -g root -m 0700 /opt/laandet/edge/secrets /etc/laandet
```

Copy from the repository (`laandet/deploy/`, at the release you are setting up):

```sh
install -m 0755 deploy.sh /opt/laandet/bin/laandet-deploy
install -m 0755 backup/backup.sh /opt/laandet/bin/laandet-backup
install -m 0755 backup/restore.sh /opt/laandet/bin/laandet-restore-test
install -m 0644 compose.edge.yaml Caddyfile /opt/laandet/edge/
```

**Docker group = root.** The deploy user can control Docker, which is equivalent to root. That is why its
SSH key is limited to the deploy command:

- [ ] Create a dedicated key pair for GitHub Actions (`ssh-keygen -t ed25519 -C github-actions-laandet`).
- [ ] `/home/laandet-deploy/.ssh/authorized_keys` (owned by root, mode 0644):
      `restrict,command="/opt/laandet/bin/laandet-deploy" ssh-ed25519 AAAA… github-actions-laandet`
- [ ] The private key goes only into the GitHub environment secret `LAANDET_SSH_PRIVATE_KEY`
      (`DEPLOY.md`). `ssh-keyscan <server>` output goes into `LAANDET_SSH_KNOWN_HOSTS` — check the
      fingerprint against the provider console first.

## 5. Secrets (per environment)

Generate every value on the server; keep a copy in the owner's password manager. Different values for
staging and production (SEC-41). Hex values need no URL escaping.

```sh
env=production   # then repeat with env=staging
cd /opt/laandet/$env/secrets
for f in pg_superuser_password pg_owner_password pg_app_password; do openssl rand -hex 32 > $f; done
chmod 0644 pg_*_password        # read inside the postgres container; the directory itself is 0750
cp /path/to/laandet/deploy/env/app.env.example app.env
cp /path/to/laandet/deploy/env/migrate.env.example migrate.env
chown root:laandet-deploy app.env migrate.env && chmod 0640 app.env migrate.env
cp /path/to/laandet/deploy/env/deploy.conf.example ../deploy.conf && chmod 0644 ../deploy.conf
```

Fill in `app.env` (`DATABASE_URL` uses `pg_app_password`, `BETTER_AUTH_SECRET` and `IP_HASH_KEY` from
`openssl rand -hex 32`, SMTP from the email provider, operator details), `migrate.env`
(`DATABASE_MIGRATION_URL` uses `pg_owner_password`) and `deploy.conf` (`LAANDET_IMAGE_REPO`).
Staging: `APP_ENV=staging`, `APP_URL=https://staging.<domain>`, and a sandbox SMTP or none.

Production refuses to start without `SMTP_URL`, an `https://` `APP_URL` and the operator details, and
`load-legal` refuses legal texts that still contain `MÅ FYLLES UT FØR LANSERING`.

## 6. Image registry access

If the GHCR package `laandet-app` is private: create a fine-grained or classic token with
`read:packages` only, then as `laandet-deploy`: `docker login ghcr.io -u <github user>`.
(Alternatively the owner makes the package public — the image contains no secrets.)

## 7. Edge (Caddy)

```sh
cp /path/to/laandet/deploy/env/edge.env.example /opt/laandet/edge/secrets/edge.env   # set domain + email
docker run --rm caddy:2.11.7 caddy hash-password --plaintext '<long random staging password>'
# write /opt/laandet/edge/secrets/staging-basic-auth.caddy from env/staging-basic-auth.caddy.example
chmod 0600 /opt/laandet/edge/secrets/edge.env; chmod 0644 /opt/laandet/edge/secrets/staging-basic-auth.caddy
docker network create laandet-edge-production; docker network create laandet-edge-staging
cd /opt/laandet/edge && LAANDET_EDGE_SECRETS_DIR=/opt/laandet/edge/secrets docker compose -f compose.edge.yaml up -d
```

Caddy gets certificates once DNS points at the server. Its admin API is off; after changing the
Caddyfile, run `docker compose -f compose.edge.yaml restart`.

## 8. Backups (SEC-53)

1. Order the off-site storage (owner approval, `BILLING.md`). For a Storage Box: enable SSH access, add
   root's public key (`ssh-keygen -t ed25519` as root), and add the box to `/root/.ssh/known_hosts`.
2. `openssl rand -base64 48 > /etc/laandet/restic-production.pass && chmod 0600 /etc/laandet/restic-production.pass`
   — **also store it in the owner's password manager**: without it the backups cannot be read.
3. `/etc/laandet/backup-production.env` from `deploy/env/backup.env.example` (mode 0600).
4. `set -a; . /etc/laandet/backup-production.env; set +a; restic init`
5. Timers:
   ```sh
   install -m 0644 backup/laandet-backup@.service backup/laandet-backup@.timer /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now laandet-backup@production.timer
   systemctl start laandet-backup@production.service && journalctl -u laandet-backup@production -n 50
   ```
6. Run the first restore test (`RESTORE.md`) and record it in `RESTORE_LOG.md`.

Staging is not backed up (synthetic data only).

## 9. Monitoring

- [ ] Uptime monitor (D-027, e.g. UptimeRobot free — owner creates the account) on
      `https://<domain>/healthz`, alerts to the owner.
- [ ] Optional: a dead-man's-switch URL in `BACKUP_HEARTBEAT_URL` so a missed backup raises an alert.

## 10. Done when

- [ ] `ss -tlnp` shows only 22, 80, 443 on public interfaces.
- [ ] `ssh root@server` and password logins are refused.
- [ ] `psql -h <server>` from outside cannot connect.
- [ ] The first staging deploy (`DEPLOY.md`) passes, and `curl -I https://staging.<domain>` shows HSTS,
      CSP, `nosniff`, `frame-ancestors 'none'` and `X-Robots-Tag: noindex`.
- [ ] Backup timer active, first restore test logged.
