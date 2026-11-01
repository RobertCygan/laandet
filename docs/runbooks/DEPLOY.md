# Runbook — Deploy and rollback (P01-13, ARCHITECTURE.md §6)

**Status:** not executed on a real server (no server exists yet). The scripts were rehearsed locally,
see `laandet/deploy/README.md`.

## How a deploy works

1. A git tag starts `.github/workflows/laandet-deploy.yml`:
   - `laandet-vX.Y.Z-staging` → **staging**
   - `laandet-vX.Y.Z` → **production** (needs a reviewer's approval on the GitHub environment)
   - or a manual run (Actions → *Laandet deploy* → *Run workflow*) with an existing tag and environment.
2. The workflow builds the image from `laandet/app` and pushes `ghcr.io/<owner>/laandet-app:<tag>`.
3. It sends `laandet/deploy/` (at the tag) over SSH to the server. The deploy key can only run
   `/opt/laandet/bin/laandet-deploy`, which:
   1. unpacks the bundle into `/opt/laandet/<env>/releases/<tag>/`;
   2. pulls the image;
   3. takes a **pre-deploy dump** (`/var/backups/laandet/<env>/predeploy/`, newest 10 kept);
   4. starts the database, runs **migrations** (owner role), loads the **legal texts** (production refuses
      unfinished drafts), runs the idempotent **reference-data seed** (staging also seeds labelled demo
      listings);
   5. starts `app` and `worker` and waits until the app is healthy;
   6. **on any failure after the image pull**, starts the previous release again and exits with an error.
4. The workflow checks `https://<host>/healthz` and the security headers over HTTPS.

Migrations are forward-only and written expand/contract, so the previous image can run on the new schema.

## One-time GitHub configuration (owner)

- [ ] Server set up (`SERVER_SETUP.md`).
- [ ] Settings → Environments: create `staging` and `production`.
      `production`: required reviewers = the owner; deployment branches/tags limited to `laandet-v*`.
- [ ] In **each** environment:

  | Kind | Name | Value |
  |---|---|---|
  | secret | `LAANDET_SSH_HOST` | server host name or IP |
  | secret | `LAANDET_SSH_USER` | `laandet-deploy` |
  | secret | `LAANDET_SSH_PRIVATE_KEY` | the deploy private key (SERVER_SETUP §4) |
  | secret | `LAANDET_SSH_KNOWN_HOSTS` | `ssh-keyscan` output, fingerprint checked |
  | variable | `LAANDET_PUBLIC_URL` | `https://staging.<domain>` / `https://<domain>` |

- [ ] Repository variable `LAANDET_DEPLOY_ENABLED` = `true`. Until then a tag only prints a notice.

## Normal deploy

```sh
git tag laandet-v0.1.0-staging && git push origin laandet-v0.1.0-staging     # staging first
# check staging (below), then:
git tag laandet-v0.1.0 && git push origin laandet-v0.1.0                     # production (approve in Actions)
```

Production will fail at the legal step until the legal texts no longer contain
`MÅ FYLLES UT FØR LANSERING` / `KONTROLLERES FØR LANSERING` (legal review, `LEGAL_REVIEW_CHECKLIST.md`).
That is intended.

## Checks after a deploy

```sh
curl -fsS https://staging.<domain>/healthz            # {"db":"ok","media":"ok"}
curl -I https://staging.<domain>                      # 401 + HSTS, CSP, nosniff, frame-ancestors, X-Robots-Tag
ssh <admin>@server 'docker inspect laandet-staging-app-1 --format "{{.Config.User}} {{.HostConfig.ReadonlyRootfs}}"'   # node true
psql -h <server> -U postgres                          # from outside: must fail to connect
```

Then open the site, sign in with a test account, and look at one listing with images.

## Manual rollback

On the server, as the admin user (`sudo -u laandet-deploy -s` or root):

```sh
env=production
cd /opt/laandet/$env
prev=$(cat previous-tag)
. ./deploy.conf
files="-f releases/$prev/compose.yaml"; [ $env = staging ] && files="$files -f releases/$prev/compose.staging.yaml"
LAANDET_IMAGE=$LAANDET_IMAGE_REPO:$prev LAANDET_SECRETS_DIR=/opt/laandet/$env/secrets \
  docker compose $files up -d --wait app worker
echo "$prev" > current-tag && ln -sfn releases/$prev current
```

If a migration damaged data, restore the pre-deploy dump (RESTORE.md §3) — this loses writes made since
the dump, so announce downtime first.

## Other operations

- **Logs:** `docker logs --since 1h laandet-app-1` (staging: `laandet-staging-app-1`). Logs never contain
  emails, tokens or raw IPs (SEC-43) — do not add debugging that prints them.
- **Grant a staff role** (AUTH_MODEL §2):
  ```sh
  cd /opt/laandet/production/current
  LAANDET_IMAGE=$(. ../deploy.conf; echo $LAANDET_IMAGE_REPO):$(cat ../current-tag) LAANDET_SECRETS_DIR=/opt/laandet/production/secrets \
    docker compose -f compose.yaml run --rm tools node scripts/grant-role.mjs --email <email> --role moderator --reason "<why>"
  ```
  The user must then sign in again and set up two-factor login at `/konto/tofaktor`.
- **Direct database access** to personal data: only when necessary, and record it in `ACCESS_LOG.md`.
