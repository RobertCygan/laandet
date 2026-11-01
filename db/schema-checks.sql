-- =============================================================================
-- Laandet — executable checks for db/schema-draft.sql (Phase 00)
-- Run against a fresh database that has schema-draft.sql applied:
--   psql -v ON_ERROR_STOP=1 -d <db> -f db/schema-checks.sql
-- Every check raises an exception on failure, so a clean run prints only NOTICEs
-- and finishes with "ALL SCHEMA CHECKS PASSED".
-- =============================================================================

\o /dev/null
BEGIN;

-- Helper: assert that a statement fails (with any error).
CREATE FUNCTION pg_temp.expect_error(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'ok   % (rejected: %)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL % — statement was accepted but must be rejected', label;
END $$;

-- ---------------------------------------------------------------- fixtures
INSERT INTO users (id, name, email, email_verified) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Eier Ola', 'ola@example.test', true),
  ('00000000-0000-0000-0000-00000000000b', 'Leier Kari', 'kari@example.test', true),
  ('00000000-0000-0000-0000-00000000000c', 'Tredje Per', 'per@example.test', true);
INSERT INTO localities (id, slug, name, municipality) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'leinesfjord', 'Leinesfjord', 'Steigen');
INSERT INTO categories (id, slug, labels, policy) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'verktoy', '{"nb":"Verktøy","en":"Tools"}', 'allowed');
INSERT INTO legal_document_versions (id, doc_key, locale, version, is_authoritative, content_md, content_sha256)
VALUES ('00000000-0000-0000-0000-0000000000d1', 'rental_simple', 'nb', '0.1.0-utkast', true, '# Forenklet leieavtale',
        repeat('a', 64));

INSERT INTO listings (id, owner_id, type, status, title, description, category_id, locality_id,
                      item_condition, price_ore, price_unit, declared_value_ore, deposit_ore, handover_pickup)
VALUES ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000000a', 'rent_out', 'published',
        'Slagdrill', 'Solid slagdrill med koffert.', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-0000000000f1', 'good', 10000, 'day', 450000, 50000, true);

INSERT INTO conversations (id, listing_id, initiator_id, listing_owner_id) VALUES
  ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000001a1',
   '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------- listings
DO $$ BEGIN
  IF (SELECT value_category FROM listings WHERE id = '00000000-0000-0000-0000-0000000001a1') <> 'A' THEN
    RAISE EXCEPTION 'FAIL value 4 500 kr must be category A';
  END IF;
  RAISE NOTICE 'ok   4 500 kr -> category A';
END $$;

SELECT pg_temp.expect_error($s$
  INSERT INTO listings (owner_id, type, title, description, category_id, locality_id, item_condition,
                        price_ore, price_unit, declared_value_ore, deposit_ore, handover_pickup)
  VALUES ('00000000-0000-0000-0000-00000000000a','rent_out','Test','Beskrivelse her',
          '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1','good',
          1000,'day',100000,200000,true) $s$, 'deposit above declared value');

SELECT pg_temp.expect_error($s$
  INSERT INTO listings (owner_id, type, title, description, category_id, locality_id, item_condition)
  VALUES ('00000000-0000-0000-0000-00000000000a','rent_out','Test','Beskrivelse her',
          '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1','good') $s$,
  'rent_out without price/value');

SELECT pg_temp.expect_error($s$
  INSERT INTO listings (owner_id, type, title, description, category_id, locality_id, item_condition,
                        known_defects, price_ore, handover_pickup)
  VALUES ('00000000-0000-0000-0000-00000000000a','give_away','Sofa','Gammel sofa gis bort',
          '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1','worn',
          'Flekk på puten', 5000, true) $s$, 'give_away with a price');

SELECT pg_temp.expect_error($s$
  INSERT INTO listings (owner_id, type, title, description, category_id, locality_id, item_condition,
                        handover_pickup)
  VALUES ('00000000-0000-0000-0000-00000000000a','give_away','Sofa','Gammel sofa gis bort',
          '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1','worn', true) $s$,
  'give_away without known_defects');

SELECT pg_temp.expect_error($s$
  INSERT INTO listings (owner_id, type, status, title, description, category_id, locality_id,
                        item_condition, known_defects)
  VALUES ('00000000-0000-0000-0000-00000000000a','give_away','published','Sofa','Gammel sofa gis bort',
          '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1','worn','Ingen') $s$,
  'published give_away without any handover option');

-- ---------------------------------------------------------------- bookings
INSERT INTO bookings (id, listing_id, conversation_id, owner_id, renter_id, status, period, value_category,
                      declared_value_ore, price_ore, price_unit, units, total_price_ore, deposit_ore,
                      handover_method, return_method, owner_response_due_at)
VALUES ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000001a1',
        '00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b', 'accepted',
        tstzrange('2026-12-18 10:00+01', '2026-12-20 10:00+01'), 'A', 450000, 10000, 'day', 2, 20000, 50000,
        'pickup', 'pickup', now() + interval '72 hours');

-- A second REQUEST for overlapping dates is allowed (requests do not reserve) …
INSERT INTO bookings (listing_id, conversation_id, owner_id, renter_id, status, period, value_category,
                      declared_value_ore, price_ore, price_unit, units, total_price_ore,
                      handover_method, return_method, owner_response_due_at)
VALUES ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000002a1',
        '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'requested',
        tstzrange('2026-12-19 10:00+01', '2026-12-21 10:00+01'), 'A', 450000, 10000, 'day', 2, 20000,
        'pickup', 'pickup', now() + interval '72 hours');
DO $$ BEGIN RAISE NOTICE 'ok   overlapping request accepted while only one booking is active'; END $$;

-- … but accepting it while the first is active must fail (no double booking).
SELECT pg_temp.expect_error($s$
  UPDATE bookings SET status = 'accepted'
  WHERE status = 'requested' AND listing_id = '00000000-0000-0000-0000-0000000001a1' $s$,
  'double booking of overlapping period');

SELECT pg_temp.expect_error($s$
  INSERT INTO bookings (listing_id, conversation_id, owner_id, renter_id, status, period, value_category,
                        declared_value_ore, price_ore, price_unit, units, total_price_ore,
                        handover_method, return_method, owner_response_due_at)
  VALUES ('00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000002a1',
          '00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','requested',
          tstzrange('2027-01-05 10:00+01','2027-01-06 10:00+01'),'B',900000,10000,'day',1,10000,
          'pickup','pickup', now() + interval '72 hours') $s$,
  'category B booking blocked in MVP');

SELECT pg_temp.expect_error($s$
  INSERT INTO bookings (listing_id, conversation_id, owner_id, renter_id, period, value_category,
                        declared_value_ore, price_ore, price_unit, units, total_price_ore,
                        handover_method, return_method, owner_response_due_at)
  VALUES ('00000000-0000-0000-0000-0000000001a1','00000000-0000-0000-0000-0000000002a1',
          '00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a',
          tstzrange('2027-02-05 10:00+01','2027-02-06 10:00+01'),'A',450000,10000,'day',1,10000,
          'pickup','pickup', now() + interval '72 hours') $s$,
  'owner renting own item');

-- ---------------------------------------------------------------- contracts
INSERT INTO contracts (id, kind, booking_id, template_version_id, agreement_number, terms, rendered_text, rendered_sha256)
VALUES ('00000000-0000-0000-0000-0000000004a1', 'rental_simple', '00000000-0000-0000-0000-0000000003a1',
        '00000000-0000-0000-0000-0000000000d1', 'LA-2026-000001', '{}', 'Avtaletekst',
        encode(sha256('Avtaletekst'::bytea), 'hex'));

SELECT pg_temp.expect_error($s$
  INSERT INTO contract_acceptances (contract_id, user_id, party_role, accepted_sha256)
  VALUES ('00000000-0000-0000-0000-0000000004a1','00000000-0000-0000-0000-00000000000b','renter', repeat('0',64)) $s$,
  'acceptance with wrong text hash');

SELECT pg_temp.expect_error($s$
  INSERT INTO contract_acceptances (contract_id, user_id, party_role, accepted_sha256)
  VALUES ('00000000-0000-0000-0000-0000000004a1','00000000-0000-0000-0000-00000000000a','renter',
          encode(sha256('Avtaletekst'::bytea),'hex')) $s$,
  'owner forging the renter''s acceptance');

SELECT pg_temp.expect_error($s$
  INSERT INTO contract_acceptances (contract_id, user_id, party_role, accepted_sha256)
  VALUES ('00000000-0000-0000-0000-0000000004a1','00000000-0000-0000-0000-00000000000c','renter',
          encode(sha256('Avtaletekst'::bytea),'hex')) $s$,
  'third party accepting');

INSERT INTO contract_acceptances (contract_id, user_id, party_role, accepted_sha256)
VALUES ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-00000000000b', 'renter',
        encode(sha256('Avtaletekst'::bytea), 'hex'));
DO $$ BEGIN RAISE NOTICE 'ok   renter acceptance with correct hash stored'; END $$;

SELECT pg_temp.expect_error($s$
  INSERT INTO contracts (kind, booking_id, template_version_id, agreement_number, revision, terms, rendered_text, rendered_sha256)
  VALUES ('rental_simple','00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000000d1',
          'LA-2026-000002', 2, '{}','Annen tekst', repeat('b',64)) $s$,
  'second live contract for same booking without superseding the first');

-- ---------------------------------------------------------------- reviews
SELECT pg_temp.expect_error($s$
  INSERT INTO reviews (booking_id, author_id, subject_id, author_role, rating_communication, rating_punctuality,
                       rating_item_condition, rating_agreement)
  VALUES ('00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-00000000000a','owner',5,5,5,5) $s$,
  'self-review');

-- ---------------------------------------------------------------- runtime role privileges
SET LOCAL ROLE laandet_app;

INSERT INTO audit_events (actor_id, action) VALUES ('00000000-0000-0000-0000-00000000000a', 'check.insert');
DO $$ BEGIN RAISE NOTICE 'ok   runtime role can append audit events'; END $$;

SELECT pg_temp.expect_error($s$ UPDATE audit_events SET action = 'tampered' $s$,
  'runtime role updating audit_events');
SELECT pg_temp.expect_error($s$ DELETE FROM audit_events $s$,
  'runtime role deleting audit_events');
SELECT pg_temp.expect_error($s$ DELETE FROM contract_acceptances $s$,
  'runtime role deleting contract acceptances');
SELECT pg_temp.expect_error($s$ UPDATE contracts SET rendered_text = 'endret' $s$,
  'runtime role rewriting agreement text');

UPDATE contracts SET status = 'pending_acceptance' WHERE id = '00000000-0000-0000-0000-0000000004a1';
DO $$ BEGIN RAISE NOTICE 'ok   runtime role may change contract status column'; END $$;

SELECT pg_temp.expect_error($s$
  INSERT INTO legal_document_versions (doc_key, locale, version, is_authoritative, content_md, content_sha256)
  VALUES ('terms','nb','9.9.9',true,'x', repeat('c',64)) $s$,
  'runtime role publishing legal documents');

RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'ALL SCHEMA CHECKS PASSED'; END $$;
ROLLBACK;
