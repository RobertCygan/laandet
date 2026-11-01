#!/usr/bin/env bash
# Laandet — set up (or update) the production server in one go. DECISIONS D-060.
#
# For a fresh Ubuntu 24.04 VPS, run as root:
#   curl -fsSL https://raw.githubusercontent.com/RobertCygan/laandet/main/deploy/bootstrap.sh -o bootstrap.sh
#   bash bootstrap.sh
#
# It asks one question, the password of the mailbox that sends Laandet's e-mail, and tests it at once
# by sending a test e-mail to that mailbox (kontakt@gpsi.ai; laandet.steigen@gpsi.ai is only an alias of
# it and cannot log in). To send as another address, give both, e.g.
#   LAANDET_MAILBOX=other@gpsi.ai LAANDET_SMTP_USER=kontakt@gpsi.ai bash bootstrap.sh Everything else runs unattended (about 15–25 minutes):
#   1. system updates, automatic security updates, fail2ban, firewall (22, 80, 443), 2 GB swap;
#   2. Docker Engine and the Compose plugin from Docker's apt repository;
#   3. the repository in /opt/laandet/src and the application image, built on this server;
#   4. secrets generated here (they never leave the server) and the settings files;
#   5. deploy.sh: database, migrations, legal texts, reference data, app and worker;
#   6. Caddy with HTTPS for the domain;
#   7. nightly encrypted backups (restic) on this server, kept 7 days / 4 weeks / 6 months;
#   8. the commands laandet-admin (give someone a staff role) and laandet-update (newest code).
#
# Running it again updates the code and keeps every secret and setting. The settings below can be
# changed with environment variables, e.g. LAANDET_REF=some-branch bash bootstrap.sh
set -Eeuo pipefail
umask 027

IMAGE_REPO=laandet-app
ROOT=/opt/laandet
SRC=$ROOT/src
ENV_DIR=$ROOT/production
SECRETS=$ENV_DIR/secrets
EDGE=$ROOT/edge/secrets

# On a server that is already set up, the current app.env is the memory: the domain, the sender and
# the mailbox login are read from it, so `laandet-update` keeps them. A value given on the command
# line wins; the built-in defaults are only for the first run.
previous() { # previous <domain|mailbox|smtp_user|smtp_host>
  [[ -r $SECRETS/app.env ]] || return 0
  PREVIOUS_WHAT=$1 python3 - "$SECRETS/app.env" <<'PY'
import os, re, sys, urllib.parse
env = {}
for line in open(sys.argv[1], encoding="utf-8"):
    m = re.match(r'^([A-Z0-9_]+)=(.*)$', line.rstrip("\n"))
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"')
what = os.environ["PREVIOUS_WHAT"]
smtp = urllib.parse.urlsplit(env.get("SMTP_URL", ""))
if what == "domain" and env.get("APP_URL", "").startswith("https://"):
    print(urllib.parse.urlsplit(env["APP_URL"]).hostname or "")
elif what == "mailbox":
    m = re.search(r"<([^>]+)>", env.get("MAIL_FROM", ""))
    print(m.group(1) if m else "")
elif what == "smtp_user" and smtp.username:
    print(urllib.parse.unquote(smtp.username))
elif what == "smtp_host" and smtp.hostname:
    print(smtp.hostname)
PY
}
PREV_DOMAIN=$(previous domain)
PREV_MAILBOX=$(previous mailbox)
PREV_SMTP_USER=$(previous smtp_user)
PREV_SMTP_HOST=$(previous smtp_host)

REPO_URL=${LAANDET_REPO_URL:-https://github.com/RobertCygan/laandet.git}
REF=${LAANDET_REF:-main}
DOMAIN=${LAANDET_DOMAIN:-${PREV_DOMAIN:-laandet.gpsi.ai}}
# MAILBOX is the sender address; SMTP_USER is the mailbox that logs in (an alias cannot log in).
MAILBOX=${LAANDET_MAILBOX:-${PREV_MAILBOX:-kontakt@gpsi.ai}}
SMTP_USER=${LAANDET_SMTP_USER:-${PREV_SMTP_USER:-$MAILBOX}}
SMTP_HOST=${LAANDET_SMTP_HOST:-${PREV_SMTP_HOST:-smtp.hostinger.com}}

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() {
  printf '\n\033[31mBŁĄD: %s\033[0m\n' "$*" >&2
  exit 1
}
trap 'die "przerwano w linii $LINENO. Skopiuj ostatnie 30 linii z tego okna i wyślij je (nie ma w nich haseł)."' ERR

[[ $EUID -eq 0 ]] || die "run as root"
# shellcheck source=/dev/null
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || die "this script expects Ubuntu 24.04 (found ${PRETTY_NAME:-unknown})"

# ---- 0. The one question, asked first so the rest can run unattended ---------------------------
smtp_test() { # smtp_test <password>: log in as SMTP_USER and send a test e-mail from MAILBOX to MAILBOX
  local cfg msg rc=0 esc
  cfg=$(mktemp) msg=$(mktemp)
  chmod 600 "$cfg"
  esc=${1//\\/\\\\}
  esc=${esc//\"/\\\"}
  printf 'user = "%s:%s"\n' "$SMTP_USER" "$esc" >"$cfg"
  printf 'From: Laandet <%s>\r\nTo: <%s>\r\nSubject: Laandet: test fra serveren\r\n\r\nServeren kan sende e-post. Denne meldingen kan slettes.\r\n' \
    "$MAILBOX" "$MAILBOX" >"$msg"
  curl -sS --max-time 30 --ssl-reqd --url "smtps://$SMTP_HOST:465" -K "$cfg" \
    --mail-from "$MAILBOX" --mail-rcpt "$MAILBOX" --upload-file "$msg" || rc=$?
  rm -f "$cfg" "$msg"
  return "$rc"
}

SMTP_PASSWORD=
# The password is asked for (and tested) on the first run, and again whenever the login, the server or
# the sender changes; otherwise the stored SMTP_URL is kept.
if [[ ! -s $SECRETS/app.env ]] || ! grep -q '^SMTP_URL=smtps://' "$SECRETS/app.env" ||
  [[ $SMTP_USER != "$PREV_SMTP_USER" || $SMTP_HOST != "$PREV_SMTP_HOST" || $MAILBOX != "$PREV_MAILBOX" ]]; then
  if [[ $SMTP_USER == "$MAILBOX" ]]; then
    step "Hasło do skrzynki $SMTP_USER (strona wysyła z niej e-maile)"
  else
    step "Hasło do skrzynki $SMTP_USER (strona wysyła e-maile jako $MAILBOX)"
  fi
  for attempt in 1 2 3; do
    read -rsp "Wpisz hasło (nie widać go przy wpisywaniu) i naciśnij Enter: " SMTP_PASSWORD </dev/tty
    echo
    [[ -n $SMTP_PASSWORD ]] || continue
    if smtp_test "$SMTP_PASSWORD"; then
      echo "OK: wysłano testowy e-mail na $MAILBOX."
      break
    fi
    echo "Skrzynka odrzuciła to hasło (próba $attempt z 3)."
    SMTP_PASSWORD=
  done
  [[ -n $SMTP_PASSWORD ]] || die "brak działającego hasła do skrzynki; nic nie zostało zmienione"
fi

server_ip=$(hostname -I | awk '{print $1}')
dns_ip=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}' || true)
if [[ $dns_ip != "$server_ip" ]]; then
  echo "UWAGA: $DOMAIN wskazuje na '${dns_ip:-nic}', a ten serwer to $server_ip. HTTPS zadziała, gdy wpis DNS będzie wskazywał ten serwer."
fi

# ---- 1. System ---------------------------------------------------------------------------------
step "1/8 System updates, firewall, swap"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold full-upgrade
apt-get -y -q install unattended-upgrades fail2ban ufw curl ca-certificates gnupg git openssl restic python3
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' >/etc/apt/apt.conf.d/20auto-upgrades
timedatectl set-timezone Europe/Oslo || true
systemctl enable --now fail2ban
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# ---- 2. Docker -----------------------------------------------------------------------------------
step "2/8 Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
if [[ ! -f /etc/docker/daemon.json ]]; then
  printf '{\n  "log-driver": "local",\n  "log-opts": { "max-size": "20m", "max-file": "10" },\n  "live-restore": true\n}\n' \
    >/etc/docker/daemon.json
  systemctl restart docker
fi

# ---- 3. Code and image ---------------------------------------------------------------------------
step "3/8 Code ($REF) and application image (the longest step, about 10 minutes)"
install -d -m 0755 "$ROOT" "$ROOT/bin"
# The code is public and goes into the image: check it out readable for everyone (umask 022).
if [[ -d $SRC/.git ]]; then
  (umask 022 && git -C "$SRC" fetch -q --depth 1 origin "$REF" && git -C "$SRC" checkout -q --force FETCH_HEAD)
else
  (umask 022 && git clone -q --depth 1 --branch "$REF" "$REPO_URL" "$SRC")
fi
chmod -R go+rX,go-w "$SRC" # also repairs a checkout made by an earlier version of this script
version=$(sed -nE 's/^  "version": "([0-9]+\.[0-9]+\.[0-9]+)".*/\1/p' "$SRC/app/package.json" | head -n1)
TAG="laandet-v${version}-$(git -C "$SRC" rev-parse --short=7 HEAD)"
if ! docker image inspect "$IMAGE_REPO:$TAG" >/dev/null 2>&1; then
  docker buildx build --load -f "$SRC/app/Dockerfile" --build-context legal="$SRC/legal" \
    -t "$IMAGE_REPO:$TAG" "$SRC/app"
  docker image inspect "$IMAGE_REPO:$TAG" >/dev/null || die "the image was not built"
fi

# ---- 4. Secrets and settings (created once, then kept) -------------------------------------------
step "4/8 Secrets and settings"
install -d -m 0750 "$ENV_DIR" "$ENV_DIR/releases" "$SECRETS"
install -d -m 0700 "$ROOT/edge" "$EDGE" /etc/laandet
install -d -m 0750 /var/backups/laandet /var/backups/laandet/production /var/backups/laandet/production/predeploy
for f in pg_superuser_password pg_owner_password pg_app_password; do
  [[ -s $SECRETS/$f ]] || openssl rand -hex 32 >"$SECRETS/$f"
  chmod 0644 "$SECRETS/$f" # read inside the postgres container; the directory is 0750
done

set_env() { # set_env <file> <key> <value>: replace the line KEY=… (or add it)
  # The value goes through the environment, not argv, so it never shows up in the process list.
  SET_ENV_FILE=$1 SET_ENV_KEY=$2 SET_ENV_VALUE=$3 python3 - <<'PY'
import os
path, key, value = os.environ["SET_ENV_FILE"], os.environ["SET_ENV_KEY"], os.environ["SET_ENV_VALUE"]
lines = open(path, encoding="utf-8").read().splitlines()
out, done = [], False
for line in lines:
    if line.startswith(key + "="):
        if not done:
            out.append(f"{key}={value}")
            done = True
        continue
    out.append(line)
if not done:
    out.append(f"{key}={value}")
open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
}
urlencode() { printf '%s' "$1" | python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=""))'; }

[[ -s $SECRETS/app.env ]] || cp "$SRC/deploy/env/app.env.example" "$SECRETS/app.env"
for key in BETTER_AUTH_SECRET IP_HASH_KEY; do
  grep -qE "^$key=[0-9a-f]{32,}$" "$SECRETS/app.env" || set_env "$SECRETS/app.env" "$key" "$(openssl rand -hex 32)"
done
set_env "$SECRETS/app.env" APP_ENV production
set_env "$SECRETS/app.env" APP_URL "https://$DOMAIN"
set_env "$SECRETS/app.env" DATABASE_URL "postgres://laandet_app:$(cat "$SECRETS/pg_app_password")@db:5432/laandet"
set_env "$SECRETS/app.env" MAIL_FROM "\"Laandet <$MAILBOX>\""
set_env "$SECRETS/app.env" OPS_ALERT_EMAIL "$MAILBOX"
if [[ -n $SMTP_PASSWORD ]]; then
  # URL-encoded, so it contains no "$" (Compose would read "$" as a variable).
  set_env "$SECRETS/app.env" SMTP_URL "smtps://$(urlencode "$SMTP_USER"):$(urlencode "$SMTP_PASSWORD")@$SMTP_HOST:465"
  SMTP_PASSWORD=
fi
printf 'APP_ENV=production\nDATABASE_MIGRATION_URL=postgres://laandet_owner:%s@db:5432/laandet\n' \
  "$(cat "$SECRETS/pg_owner_password")" >"$SECRETS/migrate.env"
chmod 0640 "$SECRETS/app.env" "$SECRETS/migrate.env"
printf 'LAANDET_IMAGE_REPO=%s\nLAANDET_KEEP_RELEASES=5\n' "$IMAGE_REPO" >"$ENV_DIR/deploy.conf"
chmod 0644 "$ENV_DIR/deploy.conf"

printf 'LAANDET_DOMAIN=%s\nACME_EMAIL=%s\n' "$DOMAIN" "$MAILBOX" >"$EDGE/edge.env"
chmod 0600 "$EDGE/edge.env"
if [[ ! -s $EDGE/staging-basic-auth.caddy ]]; then
  # There is no staging on this server; the staging site stays locked behind a password nobody knows.
  hash=$(docker run --rm caddy:2.11.7 caddy hash-password --plaintext "$(openssl rand -hex 24)")
  printf 'basic_auth @protected {\n\tnobody %s\n}\n' "$hash" >"$EDGE/staging-basic-auth.caddy"
  chmod 0644 "$EDGE/staging-basic-auth.caddy"
fi

# ---- 5. Database and application -----------------------------------------------------------------
step "5/8 Database, migrations, legal texts and application ($TAG)"
install -m 0755 "$SRC/deploy/deploy.sh" "$ROOT/bin/laandet-deploy"
for net in laandet-edge-production laandet-edge-staging; do
  docker network inspect "$net" >/dev/null 2>&1 || docker network create "$net" >/dev/null
done
tar -czf - -C "$SRC" deploy | "$ROOT/bin/laandet-deploy" production "$TAG"

# ---- 6. HTTPS ------------------------------------------------------------------------------------
step "6/8 Caddy (HTTPS)"
LAANDET_EDGE_SECRETS_DIR=$EDGE docker compose -f "$SRC/deploy/compose.edge.yaml" up -d --force-recreate

# ---- 7. Backups ----------------------------------------------------------------------------------
step "7/8 Nightly backups"
install -m 0755 "$SRC/deploy/backup/backup.sh" "$ROOT/bin/laandet-backup"
install -m 0644 "$SRC/deploy/backup/laandet-backup@.service" "$SRC/deploy/backup/laandet-backup@.timer" /etc/systemd/system/
[[ -s /etc/laandet/restic-production.pass ]] || openssl rand -hex 32 >/etc/laandet/restic-production.pass
chmod 0600 /etc/laandet/restic-production.pass
cat >/etc/laandet/backup-production.env <<EOF
RESTIC_REPOSITORY=/var/backups/laandet/restic-production
RESTIC_PASSWORD_FILE=/etc/laandet/restic-production.pass
LAANDET_PROJECT=laandet
BACKUP_HEARTBEAT_URL=
EOF
chmod 0600 /etc/laandet/backup-production.env
if ! RESTIC_PASSWORD_FILE=/etc/laandet/restic-production.pass restic -r /var/backups/laandet/restic-production cat config >/dev/null 2>&1; then
  RESTIC_PASSWORD_FILE=/etc/laandet/restic-production.pass restic -q -r /var/backups/laandet/restic-production init
fi
systemctl daemon-reload
systemctl enable --now laandet-backup@production.timer >/dev/null

# ---- 8. Helper commands --------------------------------------------------------------------------
step "8/8 Commands laandet-admin and laandet-update"
cat >/usr/local/bin/laandet-admin <<'EOF'
#!/usr/bin/env bash
# Give a registered user a staff role:  laandet-admin <e-mail> [admin|moderator|user]
set -euo pipefail
email=${1:?usage: laandet-admin <e-mail> [admin|moderator|user]}
role=${2:-admin}
# The real release directory, as deploy.sh uses it: through the "current" link, Compose would see a
# different bind-mount path for the database and restart it.
cd "$(readlink -f /opt/laandet/production/current)"
LAANDET_IMAGE=laandet-app:$(cat /opt/laandet/production/current-tag) LAANDET_SECRETS_DIR=/opt/laandet/production/secrets \
  docker compose -f compose.yaml run --rm tools node scripts/grant-role.mjs \
  --email "$email" --role "$role" --reason "Satt av eieren på serveren $(date +%d.%m.%Y)"
EOF
cat >/usr/local/bin/laandet-update <<EOF
#!/usr/bin/env bash
# Update Laandet to the newest code on $REF (secrets and settings are kept).
set -euo pipefail
git -C $SRC fetch -q --depth 1 origin "\${1:-$REF}"
git -C $SRC checkout -q --force FETCH_HEAD
LAANDET_REF="\${1:-$REF}" exec bash $SRC/deploy/bootstrap.sh
EOF
chmod 0755 /usr/local/bin/laandet-admin /usr/local/bin/laandet-update

# ---- Done ----------------------------------------------------------------------------------------
trap - ERR
step "Check"
if curl -fsS --max-time 20 --retry 6 --retry-delay 10 --retry-all-errors "https://$DOMAIN/healthz" >/dev/null 2>&1; then
  echo "https://$DOMAIN działa."
else
  echo "https://$DOMAIN jeszcze nie odpowiada. Jeśli DNS był przed chwilą zmieniany, odczekaj kilka minut i otwórz adres w przeglądarce."
fi
cat <<EOF

Gotowe ($TAG).
Dalej:
  1. Otwórz https://$DOMAIN/registrer, zarejestruj się swoim e-mailem i potwierdź go linkiem z e-maila.
  2. Tutaj wpisz:  laandet-admin <twój e-mail>
  3. Aktualizacja w przyszłości:  laandet-update
Kopie zapasowe: /var/backups/laandet/restic-production (klucz: /etc/laandet/restic-production.pass).
EOF
