#!/bin/sh
# Runs once, when the database volume is empty (docker-entrypoint-initdb.d), as the postgres user.
# Creates the two Laandet roles and the database (DATA_MODEL.md §8, DECISIONS D-022):
#   laandet_owner  owns the schema; used only by migrate/legal/seed (DATABASE_MIGRATION_URL)
#   laandet_app    least-privilege runtime role; table grants come from migration 0002_privileges
# Passwords are read from Compose secrets, never from this repository.
set -eu

owner_pw=$(cat "$LAANDET_OWNER_PASSWORD_FILE")
app_pw=$(cat "$LAANDET_APP_PASSWORD_FILE")
[ -n "$owner_pw" ] && [ -n "$app_pw" ] || { echo "Missing Laandet role passwords" >&2; exit 1; }

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$owner_pw" -v app_pw="$app_pw" <<'SQL'
CREATE ROLE laandet_owner LOGIN PASSWORD :'owner_pw';
CREATE ROLE laandet_app LOGIN PASSWORD :'app_pw';
CREATE DATABASE laandet OWNER laandet_owner;
REVOKE ALL ON DATABASE laandet FROM PUBLIC;
GRANT CONNECT ON DATABASE laandet TO laandet_app;
SQL

# Extensions used by the schema; created here because some need superuser on stock PostgreSQL.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname laandet <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL
echo "Laandet roles, database and extensions created."
