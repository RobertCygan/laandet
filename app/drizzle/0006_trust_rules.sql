-- Phase 03 rules that Drizzle cannot express (DISPUTE_POLICY.md, AUTH_MODEL.md §4–5, DATA_MODEL.md §8).
-- rollback: DROP TRIGGER review_guard ON reviews; DROP FUNCTION check_review();
--           DROP TRIGGER proposal_guard ON dispute_proposals; DROP FUNCTION check_dispute_proposal();
--           DROP TRIGGER support_grant_guard ON support_access_grants; DROP FUNCTION check_support_grant();
--           GRANT UPDATE, DELETE ON dispute_events, support_access_grants, reviews, dispute_proposals TO laandet_app;

-- The case file and staff access grants are append-only (a renewal is a new grant).
REVOKE UPDATE, DELETE ON dispute_events, support_access_grants FROM laandet_app;
--> statement-breakpoint
-- Ratings and comments never change once written; only publication and moderation move.
REVOKE UPDATE, DELETE ON reviews FROM laandet_app;
--> statement-breakpoint
GRANT UPDATE (status, published_at) ON reviews TO laandet_app;
--> statement-breakpoint
-- A proposal's terms never change; only its answer.
REVOKE UPDATE, DELETE ON dispute_proposals FROM laandet_app;
--> statement-breakpoint
GRANT UPDATE (status, responded_by, responded_at) ON dispute_proposals TO laandet_app;
--> statement-breakpoint
-- A review comes from one party of a completed rental and is about the other party.
CREATE OR REPLACE FUNCTION check_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id;
  IF b.status <> 'completed' THEN
    RAISE EXCEPTION 'booking % is not completed', NEW.booking_id;
  END IF;
  IF NOT ((NEW.author_role = 'owner' AND NEW.author_id = b.owner_id AND NEW.subject_id = b.renter_id)
       OR (NEW.author_role = 'renter' AND NEW.author_id = b.renter_id AND NEW.subject_id = b.owner_id)) THEN
    RAISE EXCEPTION 'review author and subject must be the two parties of booking %', NEW.booking_id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER review_guard BEFORE INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION check_review();
--> statement-breakpoint
-- Proposals are made and answered by the two parties of the case only (never by staff, never one's own).
CREATE OR REPLACE FUNCTION check_dispute_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d disputes%ROWTYPE;
BEGIN
  SELECT * INTO d FROM disputes WHERE id = NEW.dispute_id;
  IF TG_OP = 'INSERT' AND NEW.proposer_id NOT IN (d.opened_by, d.respondent_id) THEN
    RAISE EXCEPTION 'only a party of dispute % can make a proposal', NEW.dispute_id;
  END IF;
  IF NEW.responded_by IS NOT NULL AND NEW.responded_by NOT IN (d.opened_by, d.respondent_id) THEN
    RAISE EXCEPTION 'only a party of dispute % can answer a proposal', NEW.dispute_id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER proposal_guard BEFORE INSERT OR UPDATE ON dispute_proposals
  FOR EACH ROW EXECUTE FUNCTION check_dispute_proposal();
--> statement-breakpoint
-- Grants only for active staff, and never for a case or report the staff member is part of.
CREATE OR REPLACE FUNCTION check_support_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r text; s text; d disputes%ROWTYPE;
BEGIN
  SELECT role, status INTO r, s FROM user_profiles WHERE user_id = NEW.staff_id;
  IF r IS NULL OR r NOT IN ('moderator', 'admin') OR s <> 'active' THEN
    RAISE EXCEPTION 'user % is not active staff', NEW.staff_id;
  END IF;
  IF NEW.dispute_id IS NOT NULL THEN
    SELECT * INTO d FROM disputes WHERE id = NEW.dispute_id;
    IF NEW.staff_id IN (d.opened_by, d.respondent_id) THEN
      RAISE EXCEPTION 'staff % is a party of dispute %', NEW.staff_id, NEW.dispute_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER support_grant_guard BEFORE INSERT ON support_access_grants
  FOR EACH ROW EXECUTE FUNCTION check_support_grant();
