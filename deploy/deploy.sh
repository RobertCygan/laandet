#!/usr/bin/env bash
# Laandet deploy — runs ON THE SERVER as the restricted deploy user (docs/runbooks/DEPLOY.md).
#
# Installed by the owner as /opt/laandet/bin/laandet-deploy (root:root, 0755) and used as the SSH
# forced command of the deploy key, so the key can do nothing else:
#   restrict,command="/opt/laandet/bin/laandet-deploy" ssh-ed25519 AAAA… github-actions-laandet
# The GitHub workflow calls:  ssh deploy@server "<environment> <tag>" < deploy-bundle.tar.gz
# (the bundle is a tar.gz of laandet/deploy/ at that tag). It can also be run by hand:
#   laandet-deploy staging laandet-v0.1.0-staging < bundle.tar.gz
#
# Steps: unpack bundle → pull image → pre-deploy pg_dump → db up → migrate → legal → seed →
# app + worker up and healthy. If anything after the image pull fails, the previous image is
# started again (automatic rollback) and the script exits non-zero. Migrations are forward-only
# and backward compatible (expand/contract, ARCHITECTURE.md §6), so the previous image can run on
# the migrated schema; for a destructive failure restore the pre-deploy dump (RESTORE.md).
set -Eeuo pipefail
umask 027

ROOT=${LAANDET_ROOT:-/opt/laandet}
BACKUP_ROOT=${LAANDET_BACKUP_ROOT:-/var/backups/laandet}
TAG_RE='^laandet-v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$'

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# ---- arguments (from the forced command or the command line) --------------------------------
args=${SSH_ORIGINAL_COMMAND:-"$*"}
read -r ENVIRONMENT TAG EXTRA <<<"$args" || true
[[ -z ${EXTRA:-} ]] || die "usage: <production|staging> <laandet-vX.Y.Z[-suffix]>"
case "${ENVIRONMENT:-}" in production | staging) ;; *) die "usage: <production|staging> <tag>" ;; esac
[[ ${TAG:-} =~ $TAG_RE ]] || die "invalid tag: '${TAG:-}'"
if [[ $ENVIRONMENT == production && $TAG == *-staging* ]]; then
  die "a staging tag cannot be deployed to production"
fi

ENV_DIR=$ROOT/$ENVIRONMENT
SECRETS_DIR=$ENV_DIR/secrets
[[ -f $ENV_DIR/deploy.conf ]] || die "missing $ENV_DIR/deploy.conf (see deploy/env/deploy.conf.example)"
# shellcheck source=/dev/null
source "$ENV_DIR/deploy.conf"
: "${LAANDET_IMAGE_REPO:?LAANDET_IMAGE_REPO is not set in deploy.conf}"
KEEP_RELEASES=${LAANDET_KEEP_RELEASES:-5}
for f in app.env migrate.env pg_superuser_password pg_owner_password pg_app_password; do
  [[ -s $SECRETS_DIR/$f ]] || die "missing secret file $SECRETS_DIR/$f (see docs/runbooks/SERVER_SETUP.md)"
done

# One deploy per environment at a time.
exec 9>"$ENV_DIR/.deploy.lock"
flock -n 9 || die "another deploy of $ENVIRONMENT is running"

IMAGE=$LAANDET_IMAGE_REPO:$TAG
PREVIOUS_TAG=$(cat "$ENV_DIR/current-tag" 2>/dev/null || true)
RELEASES=$ENV_DIR/releases
RELEASE=$RELEASES/$TAG
log "deploy $ENVIRONMENT $TAG (previous: ${PREVIOUS_TAG:-none})"

# ---- unpack the compose bundle -------------------------------------------------------------
[[ ! -t 0 ]] || die "expected the deploy bundle (tar.gz of laandet/deploy) on standard input"
mkdir -p "$RELEASES"
incoming=$(mktemp -d "$RELEASES/.incoming.XXXXXX")
trap 'rm -rf "$incoming"' EXIT
tar -xzf - -C "$incoming" --no-same-owner --no-same-permissions
[[ -f $incoming/deploy/compose.yaml && -f $incoming/deploy/compose.staging.yaml ]] || die "bundle does not contain deploy/compose*.yaml"
chmod -R u=rwX,g=rX,o= "$incoming/deploy"
# The init script is mounted into the postgres container, which runs as another user.
chmod -R o=rX "$incoming/deploy/db"
rm -rf "$RELEASE"
mv "$incoming/deploy" "$RELEASE"

compose_in() { # compose_in <release dir> <image> <compose args…>
  local dir=$1 image=$2
  shift 2
  local files=(-f "$dir/compose.yaml")
  [[ $ENVIRONMENT == staging ]] && files+=(-f "$dir/compose.staging.yaml")
  LAANDET_IMAGE=$image LAANDET_SECRETS_DIR=$SECRETS_DIR docker compose "${files[@]}" "$@"
}
compose() { compose_in "$RELEASE" "$IMAGE" "$@"; }

EDGE_NETWORK=laandet-edge-$ENVIRONMENT
docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1 || docker network create "$EDGE_NETWORK" >/dev/null

log "pull $IMAGE"
compose pull --quiet app

rollback() {
  local status=$?
  trap - ERR
  log "deploy of $TAG failed (exit $status)"
  if [[ -n $PREVIOUS_TAG && $PREVIOUS_TAG != "$TAG" && -d $RELEASES/$PREVIOUS_TAG ]]; then
    log "rolling back to $PREVIOUS_TAG"
    if compose_in "$RELEASES/$PREVIOUS_TAG" "$LAANDET_IMAGE_REPO:$PREVIOUS_TAG" up -d --wait --wait-timeout 180 app worker; then
      log "rollback to $PREVIOUS_TAG done; $ENVIRONMENT is running the previous release"
    else
      log "ROLLBACK FAILED — follow docs/runbooks/DEPLOY.md (manual rollback) and RESTORE.md"
    fi
  else
    log "no previous release to roll back to"
  fi
  exit 1
}
trap rollback ERR

# ---- pre-deploy database dump (only if the database already runs) ---------------------------
dump_dir=$BACKUP_ROOT/$ENVIRONMENT/predeploy
mkdir -p "$dump_dir"
db_id=$(compose ps -q db 2>/dev/null || true)
if [[ -n $db_id ]]; then
  dump=$dump_dir/predeploy-$(date -u +%Y%m%dT%H%M%SZ)-$TAG.dump
  log "pre-deploy dump → $dump"
  docker exec "$db_id" pg_dump -U postgres -Fc laandet >"$dump.partial"
  mv "$dump.partial" "$dump"
  # Keep the 10 newest pre-deploy dumps (nightly backups go off-site; these stay local).
  { ls -1t "$dump_dir"/predeploy-*.dump 2>/dev/null || true; } | tail -n +11 | xargs -r rm -f
else
  log "database not running yet (first deploy): no pre-deploy dump"
fi

# ---- database, migrations, legal texts, reference data ---------------------------------------
compose up -d --wait --wait-timeout 120 db
log "migrate"
compose run --rm migrate
log "load legal texts"
compose run --rm legal
log "seed reference data"
compose run --rm seed

# ---- application ---------------------------------------------------------------------------
log "start app and worker"
compose up -d --wait --wait-timeout 180 --remove-orphans app worker

trap - ERR
if [[ -n $PREVIOUS_TAG && $PREVIOUS_TAG != "$TAG" ]]; then
  printf '%s\n' "$PREVIOUS_TAG" >"$ENV_DIR/previous-tag"
fi
printf '%s\n' "$TAG" >"$ENV_DIR/current-tag"
ln -sfn "releases/$TAG" "$ENV_DIR/current"

# ---- housekeeping: keep the newest releases and the images of current + previous -------------
{ ls -1dt "$RELEASES"/laandet-v* 2>/dev/null || true; } | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
  [[ $(basename "$old") == "$TAG" || $(basename "$old") == "$PREVIOUS_TAG" ]] || rm -rf "$old"
done
docker image ls "$LAANDET_IMAGE_REPO" --format '{{.Tag}}' | while read -r t; do
  [[ $t == "$TAG" || $t == "$PREVIOUS_TAG" ]] && continue
  # Images still used by the other environment are kept (docker refuses to remove them).
  docker image rm "$LAANDET_IMAGE_REPO:$t" >/dev/null 2>&1 || true
done

log "deploy of $TAG to $ENVIRONMENT finished"
