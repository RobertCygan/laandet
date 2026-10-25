# Laandet — deployment files (P01-13)

**Status:** written and rehearsed locally on 25.10.2026 (see "What has been tested"). **Nothing has been
deployed, bought or registered.** A server and a domain need the owner's approval first
(`docs/runbooks/BILLING.md`, DECISIONS D-005).

One EU virtual server runs Docker Compose (D-005):

```
                    :80/:443
┌──────────── laandet-edge (compose.edge.yaml) ────────────┐
│ caddy — TLS, HSTS, fallback headers, 12 MB body limit,    │
│         staging basic auth + noindex                      │
└───────────────┬───────────────────────────┬───────────────┘
   laandet-edge-production         laandet-edge-staging
┌───────────────▼───────────┐   ┌───────────▼───────────────┐
│ project laandet            │   │ project laandet-staging    │
│ app ─ worker ─ db (pg 17)  │   │ app ─ worker ─ db (pg 17)  │
│ volumes: pgdata, media     │   │ volumes: pgdata, media     │
│ secrets: /opt/laandet/     │   │ secrets: /opt/laandet/     │
│          production/secrets│   │          staging/secrets   │
└────────────────────────────┘   └────────────────────────────┘
```

Only `app` joins its environment's edge network. PostgreSQL has no published port and is on no edge
network; production and staging cannot reach each other. Staging only ever holds synthetic data.

## Files

| File | Purpose |
|---|---|
| `../app/Dockerfile` | One image for app, worker and tools. Base image pinned by digest, non-root, read-only root filesystem; writable only `/data/media` (volume) and `/tmp` (tmpfs). |
| `compose.yaml` | One environment (production by default): `db`, `app`, `worker`, and the one-off tools `migrate`, `legal`, `seed`, `tools` (profile `tools`). |
| `compose.staging.yaml` | Staging override: own project name and edge alias, draft legal texts allowed, demo listings seeded. |
| `compose.edge.yaml` + `Caddyfile` | Caddy for both environments (it alone owns ports 80/443). |
| `db/init/10-laandet-roles.sh` | First start of an empty database: roles `laandet_owner` and `laandet_app`, database `laandet`, extensions. |
| `deploy.sh` | Server-side deploy with automatic rollback (installed as `/opt/laandet/bin/laandet-deploy`, SSH forced command). |
| `backup/backup.sh`, `backup/laandet-backup@.{service,timer}` | Nightly restic backup of the database dump and the media volume. |
| `backup/restore.sh` | Restore test into a throw-away scratch environment. |
| `env/*.example` | Names of every setting and secret (no values). |
| `../../.github/workflows/laandet-deploy.yml` | Build → GHCR → deploy over SSH. Off until `LAANDET_DEPLOY_ENABLED=true`. |

Runbooks: `../docs/runbooks/` — SERVER_SETUP, DEPLOY, RESTORE, RESTORE_LOG, ACCESS_LOG, BREACH_LOG, BILLING.

## Server layout

```
/opt/laandet/
  bin/laandet-deploy, laandet-backup, laandet-restore-test   root:root 0755 (from this directory)
  edge/            compose.edge.yaml, Caddyfile; secrets/{edge.env, staging-basic-auth.caddy}
  production/      deploy.conf; secrets/{app.env, migrate.env, pg_*_password}; releases/<tag>/;
                   current -> releases/<tag>; current-tag; previous-tag
  staging/         the same
/etc/laandet/      backup-<env>.env, restic-<env>.pass                      root:root 0600
/var/backups/laandet/<env>/{nightly,predeploy}/                             local dumps
```

## Image commands

| Purpose | Command (inside the image) |
|---|---|
| web app | `node server.js` (working dir `/app`) |
| worker | `node worker/index.mjs` (working dir `/app/tools`) |
| migrations | `node scripts/migrate.mjs` (owner role) |
| legal texts | `node scripts/load-legal.mjs [--allow-draft]` |
| reference data | `node scripts/seed.mjs [--demo]` |
| staff role | `node scripts/grant-role.mjs --email … --role moderator --reason "…"` |

The tools are the TypeScript sources from `app/worker` and `app/scripts`, bundled with esbuild in the
image build (`npm run worker` etc. still run them through tsx in development).

Build locally (from `laandet/`):

```sh
docker buildx build -f app/Dockerfile --build-context legal=legal -t laandet-app:dev app
```

## What has been tested (25.10.2026, local Docker in the development container)

- The image builds (≈ 440 MB on disk, ≈ 108 MB compressed) and runs as `node` (uid 1000) with a
  read-only root filesystem. (The sandbox needed two local-only changes that are not in the
  Dockerfile: the same base-image digest pulled through `mirror.gcr.io`, and an extra CA certificate
  for `npm ci` behind its TLS proxy.)
- `.github/workflows/laandet-deploy.yml` passes `actionlint` (with shellcheck); all shell scripts pass
  `shellcheck`.
- `compose.yaml` + `compose.staging.yaml` + `compose.edge.yaml` with `docker compose config`, and the
  Caddyfile with `caddy validate`/`caddy fmt`.
- A full staging deploy through `deploy.sh` (local registry instead of GHCR, `staging.laandet.localhost`
  with Caddy's internal CA instead of Let's Encrypt): migrations, legal texts, demo seed, app and worker
  healthy; over HTTPS: `/healthz` 200 without the password, other pages 401 without it and 200 with it;
  HSTS, CSP, `nosniff`, `X-Frame-Options: DENY` and `X-Robots-Tag: noindex` present, also on the 401
  and 413 responses; bodies over 12 MB rejected with 413.
- A deliberately broken image: the deploy failed and rolled back to the previous release automatically;
  staging stayed healthy.
- A production deploy with the current draft legal texts is refused at the legal step, as intended.
- `backup.sh` into a local restic repository, then `restore.sh` into the scratch environment:
  row counts matched and a listing with its image rendered.

Not tested (needs the real server, domain and accounts): Let's Encrypt certificates, GHCR pushes and the
GitHub workflow itself, SSH forced command, off-site Storage Box, systemd timers on the server, the
first real restore test (P01-13 acceptance test 4).
