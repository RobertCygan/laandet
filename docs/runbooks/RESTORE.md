# Runbook — Restore (P01-13, SEC-53)

**Status:** the scripts were rehearsed locally on 25.10.2026 against a local restic repository and a
local staging stack (row counts matched, a listing with its image rendered, ≈ 10 s for a tiny
database). **That is not a restore test of a real backup.** The first real restore test is still open
and is a launch gate (SEC-53, P01-13 acceptance test 4).

Recovery objectives for the pilot (OPERATING_COSTS.md §6): **RPO ≤ 24 h, RTO ≤ 4 h.**

What is backed up each night (`laandet-backup@production.timer`, about 03:15 Oslo time) into the restic
repository on EU off-site storage:
- `laandet.dump` — `pg_dump -Fc` of the database `laandet`;
- `laandet.counts.tsv` — row counts taken in the **same snapshot** as the dump;
- the media volume (`laandet_media`).

Retention: 7 daily, 4 weekly, 6 monthly. Secrets are **not** in the backup; they live in the owner's
password manager (including the restic password).

## 1. Monthly restore test (scratch environment, production untouched)

On the server, as root:

```sh
laandet-restore-test production            # latest snapshot
# or: laandet-restore-test production <snapshot-id>
```

The script restores the snapshot into `/var/tmp`, starts a separate database and app
(`laandet-restore-db`, `laandet-restore-app` on `127.0.0.1:3999`, no worker, so no email is sent), checks
the row counts against `laandet.counts.tsv`, opens the newest published listing that has an image, and
removes everything again. It prints a line for `RESTORE_LOG.md` with the real duration.

- [ ] Paste the line into `RESTORE_LOG.md`, put your name in it, commit.
- [ ] If it failed: find out why the same day; a backup that cannot be restored is not a backup.

To look around in the restored copy, add `--keep` (`laandet-restore-test production latest --keep`) and
use an SSH tunnel to `127.0.0.1:3999`. Remove it afterwards:
`docker rm -f laandet-restore-app laandet-restore-db; docker network rm laandet-restore-net; docker volume rm laandet-restore-media`.

## 2. Disaster recovery (server lost)

1. New server: `SERVER_SETUP.md` §2–7 (secrets from the password manager, **same** values).
2. Restic access: `/etc/laandet/backup-production.env` and the restic password file, then
   `set -a; . /etc/laandet/backup-production.env; set +a; restic snapshots --tag production`.
3. `restic restore latest --host laandet-production --tag laandet --target /var/tmp/r`
4. Start only the database of a fresh production project (the init script creates roles and the empty
   database):
   ```sh
   cd /opt/laandet/production/releases/<tag>    # unpack laandet/deploy at the last good tag here
   export LAANDET_IMAGE=<repo>:<tag> LAANDET_SECRETS_DIR=/opt/laandet/production/secrets
   docker compose -f compose.yaml up -d --wait db
   docker compose -f compose.yaml exec -T db pg_restore -U postgres -d laandet --exit-on-error < /var/tmp/r/var/backups/laandet/production/nightly/laandet.dump
   ```
5. Media: `cp -a /var/tmp/r/var/lib/docker/volumes/laandet_media/_data/. /var/lib/docker/volumes/laandet_media/_data/`
   (create the volume first with `docker compose -f compose.yaml create app`), then
   `chown -R 1000:1000 /var/lib/docker/volumes/laandet_media/_data`.
6. Compare the counts with `laandet.counts.tsv`, then `docker compose -f compose.yaml up -d --wait app worker`
   and point DNS at the new server if the IP changed.
7. Record the incident (and whether personal data was affected) in `BREACH_LOG.md`; log the restore in
   `RESTORE_LOG.md`.

## 3. Restore a pre-deploy dump (a migration went wrong)

Pre-deploy dumps are local: `/var/backups/laandet/<env>/predeploy/predeploy-<time>-<tag>.dump`.
This **replaces** the database and loses everything written since the dump.

```sh
cd /opt/laandet/production/current
export LAANDET_IMAGE=<repo>:<previous tag> LAANDET_SECRETS_DIR=/opt/laandet/production/secrets
docker compose -f compose.yaml stop app worker
docker compose -f compose.yaml exec -T db psql -U postgres -c "DROP DATABASE laandet WITH (FORCE)" -c "CREATE DATABASE laandet OWNER laandet_owner"
docker compose -f compose.yaml exec -T db pg_restore -U postgres -d laandet --exit-on-error < /var/backups/laandet/production/predeploy/<file>.dump
docker compose -f compose.yaml up -d --wait app worker
```

Then roll the image back (`DEPLOY.md`, manual rollback) and log what happened.
