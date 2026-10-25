-- Extensions used by the schema (run as the migration owner; requires CREATE privilege on the database).
-- rollback: DROP EXTENSION btree_gist; DROP EXTENSION pg_trgm; (only after dropping dependent objects)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
