-- Phase 02 rules that Drizzle cannot express (DATA_MODEL.md §5, §8; RENTAL_AGREEMENTS.md §3; D-022).
-- rollback: DROP TRIGGER contract_acceptance_guard ON contract_acceptances; DROP FUNCTION check_contract_acceptance();
--           ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlap; GRANT UPDATE, DELETE ON <append-only tables> TO laandet_app;

-- No two active bookings may overlap for the same listing (several requests for the same dates are fine).
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (listing_id WITH =, period WITH &&)
  WHERE (status IN ('accepted', 'confirmed', 'handed_over', 'return_pending'));
--> statement-breakpoint
-- A correction may supersede only an earlier entry in the same report (author check in the trigger below).
ALTER TABLE condition_entries ADD CONSTRAINT condition_entries_supersedes_fk
  FOREIGN KEY (supersedes_entry_id) REFERENCES condition_entries(id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_condition_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev condition_entries%ROWTYPE;
BEGIN
  IF NEW.supersedes_entry_id IS NOT NULL THEN
    SELECT * INTO prev FROM condition_entries WHERE id = NEW.supersedes_entry_id;
    IF prev.report_id <> NEW.report_id OR prev.author_id <> NEW.author_id THEN
      RAISE EXCEPTION 'an entry may only supersede the same author''s entry in the same report';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER condition_entry_guard BEFORE INSERT ON condition_entries
  FOR EACH ROW EXECUTE FUNCTION check_condition_entry();
--> statement-breakpoint
-- Defence in depth: an acceptance must match the contract text and come from the right party.
CREATE OR REPLACE FUNCTION check_contract_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c contracts%ROWTYPE; expected uuid;
BEGIN
  SELECT * INTO c FROM contracts WHERE id = NEW.contract_id;
  IF c.status <> 'pending_acceptance' THEN
    RAISE EXCEPTION 'contract % is not awaiting acceptance', c.id;
  END IF;
  IF NEW.accepted_sha256 <> c.rendered_sha256 THEN
    RAISE EXCEPTION 'accepted text does not match contract %', c.id;
  END IF;
  IF c.booking_id IS NOT NULL THEN
    SELECT CASE NEW.party_role WHEN 'owner' THEN b.owner_id WHEN 'renter' THEN b.renter_id END
      INTO expected FROM bookings b WHERE b.id = c.booking_id;
  ELSE
    SELECT CASE NEW.party_role WHEN 'giver' THEN g.giver_id WHEN 'recipient' THEN g.claimant_id END
      INTO expected FROM giveaway_claims g WHERE g.id = c.giveaway_claim_id;
  END IF;
  IF expected IS NULL OR expected <> NEW.user_id THEN
    RAISE EXCEPTION 'user % is not the % of contract %', NEW.user_id, NEW.party_role, c.id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER contract_acceptance_guard BEFORE INSERT ON contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION check_contract_acceptance();
--> statement-breakpoint
-- Append-only evidence and history (D-022). The runtime role can read and add, never change or remove.
REVOKE UPDATE, DELETE ON booking_events, contract_acceptances, condition_entries, condition_photos,
  condition_confirmations FROM laandet_app;
--> statement-breakpoint
-- Contracts: the text, terms and hash never change. Only the status moves.
REVOKE UPDATE, DELETE ON contracts FROM laandet_app;
--> statement-breakpoint
GRANT UPDATE (status, superseded_at) ON contracts TO laandet_app;
