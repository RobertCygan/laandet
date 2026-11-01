-- Retention of append-only records (PRIVACY.md §5, SEC-54, P03-06).
-- The runtime role cannot delete evidence or history itself. These narrowly scoped functions, owned by the
-- migration role, delete only what has passed its retention period. The periods are fixed here (not
-- parameters), so the app cannot purge anything early; a change needs a migration.
-- rollback: DROP FUNCTION purge_closed_disputes(), purge_expired_bookings(), purge_expired_claims(),
--           purge_closed_moderation(), purge_legal_acceptances_of_deleted_users();

-- Disputes, evidence, proposals and support access grants: 3 years after closure.
CREATE OR REPLACE FUNCTION purge_closed_disputes() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[]; n integer;
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO ids FROM disputes
   WHERE closed_at IS NOT NULL AND closed_at < now() - interval '3 years'
     AND status NOT IN ('awaiting_response', 'in_negotiation', 'support_review', 'awaiting_documentation');
  DELETE FROM support_access_grants WHERE dispute_id = ANY (ids);
  DELETE FROM dispute_events WHERE dispute_id = ANY (ids);
  DELETE FROM dispute_proposals WHERE dispute_id = ANY (ids);
  DELETE FROM disputes WHERE id = ANY (ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
-- Bookings with agreements, acceptances, history, condition reports and reviews: 3 years after the period
-- ended, once the booking is finished and no case about it is left.
CREATE OR REPLACE FUNCTION purge_expired_bookings() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[]; reps uuid[]; n integer;
BEGIN
  SELECT coalesce(array_agg(b.id), '{}') INTO ids FROM bookings b
   WHERE upper(b.period) < now() - interval '3 years'
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
-- Giveaway claims and transfer confirmations: 3 years after transfer (or after the claim closed).
CREATE OR REPLACE FUNCTION purge_expired_claims() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[]; n integer;
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO ids FROM giveaway_claims
   WHERE status IN ('transferred', 'declined', 'withdrawn', 'cancelled', 'expired')
     AND coalesce(transferred_at, updated_at) < now() - interval '3 years';
  DELETE FROM contract_acceptances
   WHERE contract_id IN (SELECT id FROM contracts WHERE giveaway_claim_id = ANY (ids));
  DELETE FROM contracts WHERE giveaway_claim_id = ANY (ids);
  DELETE FROM giveaway_claims WHERE id = ANY (ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
-- Reports, moderation actions and appeals: 2 years after closure. An action behind a measure that still
-- applies (a restricted or suspended account) is kept, so its statement of reasons stays available.
CREATE OR REPLACE FUNCTION purge_closed_moderation() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
        AND NOT EXISTS (SELECT 1 FROM moderation_actions m WHERE m.report_id = r.id));
  DELETE FROM reports r
   WHERE r.status IN ('actioned', 'dismissed') AND r.handled_at < now() - interval '2 years'
     AND NOT EXISTS (SELECT 1 FROM moderation_actions m WHERE m.report_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM support_access_grants g WHERE g.report_id = r.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
-- Legal acceptances: while the account exists + 3 years.
CREATE OR REPLACE FUNCTION purge_legal_acceptances_of_deleted_users() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM legal_acceptances a USING user_profiles p
   WHERE p.user_id = a.user_id AND p.status = 'deleted' AND p.deleted_at < now() - interval '3 years';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION purge_closed_disputes(), purge_expired_bookings(), purge_expired_claims(),
  purge_closed_moderation(), purge_legal_acceptances_of_deleted_users() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION purge_closed_disputes(), purge_expired_bookings(), purge_expired_claims(),
  purge_closed_moderation(), purge_legal_acceptances_of_deleted_users() TO laandet_app;
