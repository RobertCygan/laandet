#!/usr/bin/env bash
# Laandet nightly backup (SEC-53, P01-13): database dump + media volume → encrypted restic repository
# on EU off-site storage. Runs as root from laandet-backup@<environment>.timer.
#
#   laandet-backup production
#
# Configuration: /etc/laandet/backup-<environment>.env (see deploy/env/backup.env.example).
# The restic repository must have been initialised once (docs/runbooks/SERVER_SETUP.md).
# Retention: 7 daily, 4 weekly, 6 monthly. Integrity check (5 % of data) on Sundays.
set -Eeuo pipefail
umask 077

ENVIRONMENT=${1:-production}
[[ $ENVIRONMENT =~ ^(production|staging)$ ]] || { echo "usage: $0 <production|staging>" >&2; exit 2; }
CONF=${LAANDET_BACKUP_CONF:-/etc/laandet/backup-$ENVIRONMENT.env}
[[ -r $CONF ]] || { echo "missing $CONF" >&2; exit 1; }
# shellcheck source=/dev/null
source "$CONF"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is not set in $CONF}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is not set in $CONF}"
: "${LAANDET_PROJECT:?LAANDET_PROJECT is not set in $CONF}"
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
started=$(date +%s)

restic cat config >/dev/null || { log "restic repository not reachable or not initialised"; exit 1; }

db=$(docker ps -q --filter "label=com.docker.compose.project=$LAANDET_PROJECT" --filter "label=com.docker.compose.service=db")
[[ -n $db ]] || { log "database container of project $LAANDET_PROJECT is not running"; exit 1; }
media=$(docker volume inspect -f '{{ .Mountpoint }}' "${LAANDET_PROJECT}_media")
[[ -d $media ]] || { log "media volume ${LAANDET_PROJECT}_media not found"; exit 1; }

work=${LAANDET_BACKUP_ROOT:-/var/backups/laandet}/$ENVIRONMENT/nightly
mkdir -p "$work"
# Fixed file names keep the snapshot paths identical from night to night.
dump=$work/laandet.dump
counts=$work/laandet.counts.tsv

# The dump and the row counts come from the same snapshot, so a restore can be checked exactly:
# a psql session exports a snapshot that pg_dump then uses.
coproc SNAP { docker exec -i "$db" psql -U postgres -d laandet -qAt -F $'\t' -v ON_ERROR_STOP=1; }
printf '%s\n' "BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT pg_export_snapshot();" >&"${SNAP[1]}"
read -r -t 30 -u "${SNAP[0]}" snapshot || { log "could not export a snapshot"; exit 1; }

log "dump database (snapshot $snapshot)"
docker exec "$db" pg_dump -U postgres -Fc --snapshot="$snapshot" laandet >"$dump.partial"
mv "$dump.partial" "$dump"

# Row counts at backup time; restore.sh compares the restored database against them.
printf '%s\n' "SELECT 'users', count(*) FROM users UNION ALL
  SELECT 'listings', count(*) FROM listings UNION ALL
  SELECT 'listing_images', count(*) FROM listing_images UNION ALL
  SELECT 'media_objects', count(*) FROM media_objects UNION ALL
  SELECT 'legal_acceptances', count(*) FROM legal_acceptances UNION ALL
  SELECT 'audit_events', count(*) FROM audit_events UNION ALL
  SELECT 'reports', count(*) FROM reports;" >&"${SNAP[1]}"
: >"$counts"
for _ in 1 2 3 4 5 6 7; do
  read -r -t 30 -u "${SNAP[0]}" line || { log "could not read row counts"; exit 1; }
  printf '%s\n' "$line" >>"$counts"
done
printf '%s\n' "COMMIT;" >&"${SNAP[1]}"
snap_in=${SNAP[1]}
exec {snap_in}>&-
wait "$SNAP_PID" || true

# A dump that pg_restore cannot list is not a backup.
docker exec -i "$db" pg_restore --list <"$dump" >/dev/null

log "restic backup (database dump, counts, media)"
restic backup --host "laandet-$ENVIRONMENT" --tag laandet --tag "$ENVIRONMENT" --tag nightly \
  "$dump" "$counts" "$media"

log "apply retention"
restic forget --host "laandet-$ENVIRONMENT" --tag laandet --tag "$ENVIRONMENT" --group-by host,tags \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune

if [[ $(date +%u) == 7 ]]; then
  log "weekly integrity check"
  restic check --read-data-subset=5%
fi

seconds=$(($(date +%s) - started))
log "backup of $ENVIRONMENT finished in ${seconds}s"
if [[ -n ${BACKUP_HEARTBEAT_URL:-} ]]; then
  curl -fsS -m 10 --retry 3 "$BACKUP_HEARTBEAT_URL" >/dev/null || log "heartbeat call failed"
fi
