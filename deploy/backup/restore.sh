#!/usr/bin/env bash
# Laandet restore test (SEC-53, P01-13): restore a restic snapshot into a throw-away scratch
# environment, check row counts against the counts taken at backup time, and check that a
# published listing with an image renders. Production is never touched. Run as root:
#
#   laandet-restore-test production            # latest snapshot
#   laandet-restore-test production 1a2b3c4d   # a given snapshot id
#   laandet-restore-test production latest --keep   # leave the scratch environment running
#
# The scratch app listens on 127.0.0.1:${RESTORE_PORT:-3999} only, has no worker (so it never
# sends email) and gets fresh random secrets. Everything is removed at the end unless --keep.
# For a real disaster recovery, follow docs/runbooks/RESTORE.md instead.
set -Eeuo pipefail
umask 077

ENVIRONMENT=${1:-production}
SNAPSHOT=${2:-latest}
KEEP=${3:-}
[[ $ENVIRONMENT =~ ^(production|staging)$ ]] || { echo "usage: $0 <production|staging> [snapshot|latest] [--keep]" >&2; exit 2; }
[[ $SNAPSHOT =~ ^(latest|[0-9a-f]{8,64})$ ]] || { echo "invalid snapshot id" >&2; exit 2; }
CONF=${LAANDET_BACKUP_CONF:-/etc/laandet/backup-$ENVIRONMENT.env}
# shellcheck source=/dev/null
source "$CONF"
: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD_FILE:?}" "${LAANDET_PROJECT:?}"
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
ROOT=${LAANDET_ROOT:-/opt/laandet}
# shellcheck source=/dev/null
source "$ROOT/$ENVIRONMENT/deploy.conf"
PORT=${RESTORE_PORT:-3999}
P=laandet-restore

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
started=$(date +%s)
tmp=$(mktemp -d /var/tmp/laandet-restore.XXXXXX)

cleanup() {
  if [[ $KEEP == --keep ]]; then
    log "kept: containers $P-db/$P-app, network $P-net, volume $P-media, files $tmp"
    return
  fi
  docker rm -f "$P-app" "$P-db" >/dev/null 2>&1 || true
  docker network rm "$P-net" >/dev/null 2>&1 || true
  docker volume rm "$P-media" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

if docker ps -a --format '{{.Names}}' | grep -qx "$P-db"; then
  echo "a scratch restore ($P-db) already exists; remove it first: docker rm -f $P-db $P-app" >&2
  KEEP=--keep
  exit 1
fi

# ---- 1. fetch the snapshot -------------------------------------------------------------------
log "restic restore $SNAPSHOT"
restic restore "$SNAPSHOT" --host "laandet-$ENVIRONMENT" --tag laandet --target "$tmp"
snapshot_id=$(restic snapshots "$SNAPSHOT" --host "laandet-$ENVIRONMENT" --tag laandet --json | grep -o '"short_id":"[0-9a-f]*"' | head -1 | cut -d'"' -f4 || true)
dump=$(find "$tmp" -type f -name 'laandet.dump' | head -1)
counts=$(find "$tmp" -type f -name 'laandet.counts.tsv' | head -1)
media=$(find "$tmp" -type d -path "*/volumes/${LAANDET_PROJECT}_media/_data" | head -1)
[[ -n $dump && -n $counts && -n $media ]] || { log "snapshot is missing the dump, counts or media"; exit 1; }

# ---- 2. scratch database with the same image as the live one ---------------------------------
live_db=$(docker ps -q --filter "label=com.docker.compose.project=$LAANDET_PROJECT" --filter "label=com.docker.compose.service=db" | head -1)
pg_image=$(docker inspect -f '{{.Config.Image}}' "$live_db")
app_image=$LAANDET_IMAGE_REPO:$(cat "$ROOT/$ENVIRONMENT/current-tag")
super_pw=$(openssl rand -hex 24)
app_pw=$(openssl rand -hex 24)

docker network create "$P-net" >/dev/null
docker volume create "$P-media" >/dev/null
docker run -d --name "$P-db" --network "$P-net" -e POSTGRES_PASSWORD="$super_pw" "$pg_image" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$P-db" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
# The entrypoint restarts the server once after initdb; wait until it accepts queries.
for _ in $(seq 1 30); do
  docker exec "$P-db" psql -U postgres -Atc 'SELECT 1' >/dev/null 2>&1 && break
  sleep 1
done

docker exec -i "$P-db" psql -U postgres -v ON_ERROR_STOP=1 -q -v app_pw="$app_pw" <<'SQL'
CREATE ROLE laandet_owner NOLOGIN;
CREATE ROLE laandet_app LOGIN PASSWORD :'app_pw';
CREATE DATABASE laandet OWNER laandet_owner;
SQL
log "pg_restore"
docker exec -i "$P-db" pg_restore -U postgres -d laandet --exit-on-error <"$dump"

# ---- 3. row counts ------------------------------------------------------------------------
mismatch=0
while IFS=$'\t' read -r table expected; do
  [[ $table =~ ^[a-z_]+$ ]] || continue
  actual=$(docker exec "$P-db" psql -U postgres -d laandet -Atc "SELECT count(*) FROM $table")
  if [[ $actual == "$expected" ]]; then
    log "count $table: $actual (ok)"
  else
    log "count $table: expected $expected, restored $actual (MISMATCH)"
    mismatch=1
  fi
done <"$counts"

# ---- 4. media + app, then render a listing with an image -----------------------------------
docker run --rm --network none --user 0 --entrypoint sh -v "$P-media:/data/media" -v "$media:/src:ro" "$app_image" \
  -c 'cp -a /src/. /data/media/ && chown -R 1000:1000 /data/media'
docker run -d --name "$P-app" --network "$P-net" -p "127.0.0.1:$PORT:3000" \
  --read-only --tmpfs /tmp:size=128m --cap-drop ALL --security-opt no-new-privileges:true \
  -v "$P-media:/data/media:ro" \
  -e APP_ENV=staging -e APP_URL="http://127.0.0.1:$PORT" \
  -e DATABASE_URL="postgres://laandet_app:$app_pw@$P-db:5432/laandet" \
  -e BETTER_AUTH_SECRET="$(openssl rand -hex 32)" -e IP_HASH_KEY="$(openssl rand -hex 32)" \
  -e MEDIA_DIR=/data/media -e HIBP_ENABLED=false \
  "$app_image" >/dev/null
for _ in $(seq 1 60); do
  curl -fsS -m 5 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS -m 5 "http://127.0.0.1:$PORT/healthz" >/dev/null || { log "scratch app is not healthy"; exit 1; }

page=FAIL
row=$(docker exec "$P-db" psql -U postgres -d laandet -At -F ' ' -c "
  SELECT l.id, li.media_id FROM listings l
  JOIN listing_images li ON li.listing_id = l.id
  JOIN user_profiles p ON p.user_id = l.owner_id
  WHERE l.status = 'published' AND l.deleted_at IS NULL AND p.status IN ('active','restricted')
  ORDER BY l.published_at DESC LIMIT 1")
if [[ -z $row ]]; then
  page="SKIPPED (no published listing with an image in this backup)"
else
  read -r listing_id media_id <<<"$row"
  if curl -fsS -m 10 -o /dev/null "http://127.0.0.1:$PORT/annonse/$listing_id" \
    && curl -fsS -m 10 -D - -o /dev/null "http://127.0.0.1:$PORT/media/$media_id/thumb" | grep -qi '^content-type: image/webp'; then
    page="OK (listing $listing_id and its image)"
  fi
fi

# ---- 5. result -----------------------------------------------------------------------------
seconds=$(($(date +%s) - started))
result=OK
[[ $mismatch == 0 && $page != FAIL ]] || result=FAILED
log "restore test $result in ${seconds}s — counts: $([[ $mismatch == 0 ]] && echo match || echo MISMATCH), page: $page"
echo
echo "Add this row to laandet/docs/runbooks/RESTORE_LOG.md (fill in your name):"
printf '| %s | %s | %s | %s | %s s | NAME |\n' "$(date +%d.%m.%Y)" "$ENVIRONMENT" "${snapshot_id:-$SNAPSHOT}" \
  "$result — counts $([[ $mismatch == 0 ]] && echo match || echo mismatch); page $page" "$seconds"
[[ $result == OK ]]
