-- Retention purges cannot be pulled forward by the runtime role (security review M1, L7; P03-05).
-- 0007 fixed the periods, but they were measured from dates the app writes itself (closed_at, period,
-- transferred_at, handled_at, deleted_at): the app role could backdate a row and purge its evidence at once.
-- Now every insert and update by the app role stamps last_changed_at with the database clock, and each
-- purge also waits the full period after that stamp. The migration role (restores, tests) is not stamped.
-- The audit purge keeps its parameter for compatibility but never goes below 24 months.
-- Every SECURITY DEFINER function gets search_path = public, pg_temp.
-- rollback: re-run the function bodies of 0002 and 0007; DROP TRIGGER <table>_stamp_last_changed ON
--           bookings, giveaway_claims, disputes, reports, user_profiles; DROP FUNCTION stamp_last_changed();
CREATE OR REPLACE FUNCTION stamp_last_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'laandet_app' THEN
    NEW.last_changed_at := now();
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER bookings_stamp_last_changed BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION stamp_last_changed();
--> statement-breakpoint
CREATE TRIGGER giveaway_claims_stamp_last_changed BEFORE INSERT OR UPDATE ON giveaway_claims
  FOR EACH ROW EXECUTE FUNCTION stamp_last_changed();
--> statement-breakpoint
CREATE TRIGGER disputes_stamp_last_changed BEFORE INSERT OR UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION stamp_last_changed();
--> statement-breakpoint
CREATE TRIGGER reports_stamp_last_changed BEFORE INSERT OR UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION stamp_last_changed();
--> statement-breakpoint
CREATE TRIGGER user_profiles_stamp_last_changed BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION stamp_last_changed();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purge_expired_audit_events(retention interval DEFAULT interval '24 months')
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH d AS (
    DELETE FROM audit_events WHERE occurred_at < now() - GREATEST(retention, interval '24 months') RETURNING 1)
  SELECT count(*)::integer FROM d;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purge_closed_disputes() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ids uuid[]; n integer;
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO ids FROM disputes
   WHERE closed_at IS NOT NULL AND closed_at < now() - interval '3 years'
     AND last_changed_at < now() - interval '3 years'
     AND status NOT IN ('awaiting_response', 'in_negotiation', 'support_review', 'awaiting_documentation');
  DELETE FROM support_access_grants WHERE dispute_id = ANY (ids);
  DELETE FROM dispute_events WHERE dispute_id = ANY (ids);
  DELETE FROM dispute_proposals WHERE dispute_id = ANY (ids);
  DELETE FROM disputes WHERE id = ANY (ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purge_expired_bookings() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ids uuid[]; reps uuid[]; n integer;
BEGIN
  SELECT coalesce(array_agg(b.id), '{}') INTO ids FROM bookings b
   WHERE upper(b.period) < now() - interval '3 years'
     AND b.last_changed_at < now() - interval '3 years'
     AND b.status IN ('declined', 'withdrawn', 'expired', 'cancelled', 'completed')
     AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.booking_id = b.id);
  SELECT coalesce(array_agg(id), '{}') INTO reps FROM condition_reports WHERE booking_id = ANY (ids);
  DELETE FROM reviews WHERE booking_id = ANY (ids);
  DELETE FROM condition_photos WHERE entry_id IN (SELECT id FROM condition_entries WHERE report_id = ANY (reps));
  DELETE FROM condition_confirmations WHERE report_id = ANY (reps);
  DELETE FROM condition_entries WHERE report_id = ANY (reps);
  DELETE FROM condition_reports WHERE id = ANY (reps);
  DELETE FROM contract_acceptances WHERE contract_id IN (SELECT id FROM contracts WHERE booking_id = ANY (ids));
  DELETE FROM contracts WHERE booking_id = ANY (ids);
  DELETE FROM booking_events WHERE booking_id = ANY (ids);
  DELETE FROM bookings WHERE id = ANY (ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purge_expired_claims() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ids uuid[]; n integer;
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO ids FROM giveaway_claims
   WHERE status IN ('transferred', 'declined', 'withdrawn', 'cancelled', 'expired')
     AND coalesce(transferred_at, updated_at) < now() - interval '3 years'
     AND last_changed_at < now() - interval '3 years';
  DELETE FROM contract_acceptances
   WHERE contract_id IN (SELECT id FROM contracts WHERE giveaway_claim_id = ANY (ids));
  DELETE FROM contracts WHERE giveaway_claim_id = ANY (ids);
  DELETE FROM giveaway_claims WHERE id = ANY (ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purge_closed_moderation() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM appeals WHERE status IN ('upheld', 'reversed') AND decided_at < now() - interval '2 years';
  DELETE FROM moderation_actions m
   WHERE m.created_at < now() - interval '2 years'
     AND NOT EXISTS (SELECT 1 FROM appeals a WHERE a.moderation_action_id = m.id)
     AND NOT (m.target_type = 'user' AND EXISTS (
       SELECT 1 FROM user_profiles p WHERE p.user_id = m.target_id AND p.status IN ('restricted', 'suspended')));
  DELETE FROM support_access_grants g
   WHERE g.report_id IN (
     SELECT r.id FROM reports r
      WHERE r.status IN ('actioned', 'dismissed') AND r.handled_at < now() - interval '2 years'
        AND r.last_changed_at < now() - interval '2 years'
        AND NOT EXISTS (SELECT 1 FROM moderation_actions m WHERE m.report_id = r.id));
  DELETE FROM reports r
   WHERE r.status IN ('actioned', 'dismissed') AND r.handled_at < now() - interval '2 years'
     AND r.last_changed_at < now() - interval '2 years'
     AND NOT EXISTS (SELECT 1 FROM moderation_actions m WHERE m.report_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM support_access_grants g WHERE g.report_id = r.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purge_legal_acceptances_of_deleted_users() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM legal_acceptances a USING user_profiles p
   WHERE p.user_id = a.user_id AND p.status = 'deleted' AND p.deleted_at < now() - interval '3 years'
     AND p.last_changed_at < now() - interval '3 years';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
