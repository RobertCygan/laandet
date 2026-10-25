#!/bin/sh
# Create local roles and databases for development and tests (PostgreSQL 16/17).
# Usage: sudo -u postgres sh scripts/db-setup-local.sh   (or run as any superuser)
# Passwords here are for local development only.
set -eu
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'laandet_owner') THEN
    CREATE ROLE laandet_owner LOGIN PASSWORD 'laandet_owner_dev';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'laandet_app') THEN
    CREATE ROLE laandet_app LOGIN PASSWORD 'laandet_app_dev';
  ELSE
    ALTER ROLE laandet_app LOGIN PASSWORD 'laandet_app_dev';
  END IF;
END $$;
SQL
for db in laandet_dev laandet_test; do
  if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
    psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db OWNER laandet_owner"
  fi
  # Extensions need superuser on most installations; create them here.
  psql -v ON_ERROR_STOP=1 -d "$db" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gist;"
done
echo "Local databases ready: laandet_dev, laandet_test"
