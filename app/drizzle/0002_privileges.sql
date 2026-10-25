-- Least-privilege runtime role (DECISIONS D-022, DATA_MODEL.md §8).
-- The migration owner creates all objects; the app connects as laandet_app.
-- rollback: REVOKE ALL ON ALL TABLES IN SCHEMA public FROM laandet_app; ALTER DEFAULT PRIVILEGES ... REVOKE ...
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'laandet_app') THEN
    CREATE ROLE laandet_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO laandet_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO laandet_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO laandet_app;
--> statement-breakpoint
-- Tables created by later migrations get the same default grants; each migration
-- that adds an append-only table must REVOKE UPDATE, DELETE on it explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO laandet_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO laandet_app;
--> statement-breakpoint
-- Append-only evidence and logs.
REVOKE UPDATE, DELETE ON audit_events, legal_acceptances FROM laandet_app;
--> statement-breakpoint
-- Legal texts are loaded at deploy by the owner role only.
REVOKE INSERT, UPDATE, DELETE ON legal_document_versions FROM laandet_app;
--> statement-breakpoint
-- Drizzle's own migration bookkeeping is not for the app.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'drizzle') THEN
    REVOKE ALL ON SCHEMA drizzle FROM laandet_app;
  END IF;
END $$;
--> statement-breakpoint
-- Retention of the append-only audit log (PRIVACY.md §5) runs through this
-- narrowly scoped function owned by the migration role.
CREATE OR REPLACE FUNCTION purge_expired_audit_events(retention interval DEFAULT interval '24 months')
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM audit_events WHERE occurred_at < now() - retention RETURNING 1)
  SELECT count(*)::integer FROM d;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION purge_expired_audit_events(interval) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION purge_expired_audit_events(interval) TO laandet_app;
