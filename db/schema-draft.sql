-- =============================================================================
-- Laandet — MVP database schema DRAFT (Phase 00)
-- -----------------------------------------------------------------------------
-- Status: DESIGNED. Validated by applying it to an empty PostgreSQL 16 database
-- (see docs/DATA_MODEL.md §9). Phase 01 will express this schema in Drizzle and
-- generate the real migrations; this file stays as the reviewed reference.
--
-- Conventions
--   * Primary keys: uuid (gen_random_uuid()).
--   * Money: bigint in øre (1 kr = 100 øre), columns named *_ore. NOK only.
--   * Time: timestamptz (UTC in the DB, shown as Europe/Oslo).
--   * Enumerations: text + CHECK (easy to evolve in migrations).
--   * Append-only evidence tables: runtime role gets SELECT, INSERT only.
--   * Tables marked [BETTER AUTH] are owned by Better Auth; Phase 01 must
--     reconcile them with the output of the Better Auth schema generator.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy title search
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- exclusion constraint (no double booking)

-- -----------------------------------------------------------------------------
-- 1. Identity and accounts
-- -----------------------------------------------------------------------------

-- [BETTER AUTH] core identity. "name" is the public display name.
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  email               text NOT NULL,
  email_verified      boolean NOT NULL DEFAULT false,
  image               text,
  two_factor_enabled  boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

-- [BETTER AUTH] sessions. ip_address/user_agent are kept only for the session lifetime.
CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- [BETTER AUTH] credentials (password hash lives here, provider 'credential').
CREATE TABLE accounts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id                text NOT NULL,
  provider_id               text NOT NULL,
  password                  text,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts (user_id);

-- [BETTER AUTH] email verification and password reset tokens.
CREATE TABLE verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verifications_identifier_idx ON verifications (identifier);

-- [BETTER AUTH] TOTP two-factor (mandatory for staff).
CREATE TABLE two_factors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret        text NOT NULL,
  backup_codes  text NOT NULL
);

-- [BETTER AUTH] database-backed rate limiting.
CREATE TABLE rate_limits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  count         integer NOT NULL,
  last_request  bigint NOT NULL
);

-- Localities inside the pilot area (admin-managed, no schema change to add more).
CREATE TABLE localities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name          text NOT NULL,
  municipality  text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0
);

-- Application profile, one row per user.
CREATE TABLE user_profiles (
  user_id                   uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locality_id               uuid REFERENCES localities(id),
  bio                       text CHECK (char_length(bio) <= 500),
  locale                    text NOT NULL DEFAULT 'nb' CHECK (locale IN ('nb','en')),
  role                      text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  status                    text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','restricted','suspended','deletion_pending','deleted')),
  status_reason_code        text,
  status_changed_at         timestamptz,
  -- Sign-up self-declarations (never shown as "verified"):
  age_18_confirmed_at       timestamptz NOT NULL,
  private_use_confirmed_at  timestamptz NOT NULL,
  email_notifications       boolean NOT NULL DEFAULT true,
  deletion_requested_at     timestamptz,
  deleted_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Identity verification. MVP: only 'email' (basic). BankID etc. is Phase 05.
-- No fødselsnummer is ever stored; only a salted hash of the provider subject id
-- so one real identity cannot verify many accounts.
CREATE TABLE identity_verifications (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider               text NOT NULL CHECK (provider IN ('email','bankid','manual_staff')),
  level                  text NOT NULL CHECK (level IN ('basic','strong')),
  status                 text NOT NULL CHECK (status IN ('pending','verified','failed','revoked','expired')),
  provider_subject_hash  text,
  verified_at            timestamptz,
  expires_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (level = 'basic' OR provider <> 'email')
);
CREATE UNIQUE INDEX identity_unique_subject ON identity_verifications (provider, provider_subject_hash)
  WHERE status = 'verified' AND provider_subject_hash IS NOT NULL;

CREATE TABLE user_blocks (
  blocker_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- -----------------------------------------------------------------------------
-- 2. Legal documents (terms, privacy, agreement templates …)
-- -----------------------------------------------------------------------------

CREATE TABLE legal_document_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key           text NOT NULL CHECK (doc_key IN (
                      'terms','privacy','cookies','rental_simple','rental_extended',
                      'giveaway_transfer','dispute_guidelines','prohibited_items','safe_rental')),
  locale            text NOT NULL CHECK (locale IN ('nb','en')),
  version           text NOT NULL,                -- e.g. '0.1.0-utkast'
  is_authoritative  boolean NOT NULL,             -- true for nb
  is_draft          boolean NOT NULL DEFAULT true, -- false only after legal review
  material_change   boolean NOT NULL DEFAULT false,
  content_md        text NOT NULL,
  content_sha256    text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  published_at      timestamptz,
  effective_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_key, locale, version),
  CHECK (is_authoritative = (locale = 'nb'))
);

CREATE TABLE legal_acceptances (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_version_id  uuid NOT NULL REFERENCES legal_document_versions(id),
  accepted_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_version_id)
);

-- -----------------------------------------------------------------------------
-- 3. Catalogue: categories, media, listings
-- -----------------------------------------------------------------------------

CREATE TABLE categories (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  parent_id              uuid REFERENCES categories(id),
  labels                 jsonb NOT NULL CHECK (labels ? 'nb' AND labels ? 'en'),
  icon                   text NOT NULL DEFAULT 'box',
  policy                 text NOT NULL DEFAULT 'allowed' CHECK (policy IN ('allowed','restricted','prohibited')),
  safety_notice          jsonb CHECK (safety_notice IS NULL OR (safety_notice ? 'nb' AND safety_notice ? 'en')),
  allowed_listing_types  text[] NOT NULL DEFAULT ARRAY['rent_out','wanted','give_away'],
  -- false = only free lending (price 0) allowed, e.g. means of transport while the
  -- platform-reporting (DPI) question is open (LEGAL_REVIEW_CHECKLIST L-07, D-028)
  allow_paid_rental      boolean NOT NULL DEFAULT true,
  sort_order             integer NOT NULL DEFAULT 0,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (policy <> 'restricted' OR safety_notice IS NOT NULL),
  CHECK (allowed_listing_types <@ ARRAY['rent_out','wanted','give_away'])
);

CREATE TABLE category_suggestions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  text        text NOT NULL CHECK (char_length(text) BETWEEN 2 AND 200),
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','rejected')),
  handled_by  uuid REFERENCES users(id),
  handled_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Every stored file (always a re-encoded WebP image in the MVP).
CREATE TABLE media_objects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  scope        text NOT NULL CHECK (scope IN ('listing','condition','dispute')),
  storage_key  text NOT NULL UNIQUE,
  mime_type    text NOT NULL CHECK (mime_type = 'image/webp'),
  bytes        integer NOT NULL CHECK (bytes > 0 AND bytes <= 5000000),
  width        integer NOT NULL CHECK (width BETWEEN 1 AND 4000),
  height       integer NOT NULL CHECK (height BETWEEN 1 AND 4000),
  sha256       text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE TABLE listings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 uuid NOT NULL REFERENCES users(id),
  type                     text NOT NULL CHECK (type IN ('rent_out','wanted','give_away')),
  status                   text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','published','paused','reserved','given_away',
                                             'archived','removed','deleted')),
  is_demo                  boolean NOT NULL DEFAULT false,
  title                    text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 90),
  description              text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  category_id              uuid NOT NULL REFERENCES categories(id),
  locality_id              uuid NOT NULL REFERENCES localities(id),
  area_note                text CHECK (char_length(area_note) <= 80),   -- never an exact address
  item_condition           text CHECK (item_condition IN ('new','as_new','good','fair','worn','defective')),
  known_defects            text CHECK (char_length(known_defects) <= 1000),
  -- Leies ut
  price_ore                bigint CHECK (price_ore >= 0),               -- 0 = gratis utlån
  price_unit               text CHECK (price_unit IN ('hour','day','weekend','week')),
  declared_value_ore       bigint CHECK (declared_value_ore > 0),
  value_category           text GENERATED ALWAYS AS (
                             CASE WHEN type = 'rent_out' AND declared_value_ore IS NOT NULL THEN
                               CASE WHEN declared_value_ore <= 500000 THEN 'A' ELSE 'B' END
                             END) STORED,
  deposit_ore              bigint CHECK (deposit_ore >= 0),
  usage_restrictions       text CHECK (char_length(usage_restrictions) <= 1000),
  included_accessories     text[] NOT NULL DEFAULT '{}',
  operating_instructions   text CHECK (char_length(operating_instructions) <= 2000),
  restricted_ack_at        timestamptz,  -- owner accepted the category's safety notice
  -- Ønskes leid
  wanted_from              date,
  wanted_to                date,
  budget_ore               bigint CHECK (budget_ore >= 0),
  -- Handover options (Leies ut / Gis bort: offered; Ønskes leid: preferred)
  handover_pickup          boolean NOT NULL DEFAULT false,
  handover_owner_delivery  boolean NOT NULL DEFAULT false,
  delivery_fee_ore         bigint CHECK (delivery_fee_ore >= 0),
  delivery_radius_km       integer CHECK (delivery_radius_km BETWEEN 1 AND 300),
  handover_meet            boolean NOT NULL DEFAULT false,
  meeting_area_note        text CHECK (char_length(meeting_area_note) <= 80),
  published_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz,
  search_vector            tsvector GENERATED ALWAYS AS (
                             setweight(to_tsvector('norwegian', coalesce(title,'')), 'A') ||
                             setweight(to_tsvector('norwegian', coalesce(description,'')), 'B') ||
                             setweight(to_tsvector('simple', coalesce(title,'')), 'C')) STORED,

  -- Type-specific rules
  CONSTRAINT rent_out_requires_terms CHECK (type <> 'rent_out' OR
    (price_ore IS NOT NULL AND price_unit IS NOT NULL AND declared_value_ore IS NOT NULL
     AND item_condition IS NOT NULL)),
  CONSTRAINT deposit_not_above_value CHECK (deposit_ore IS NULL OR declared_value_ore IS NULL
    OR deposit_ore <= declared_value_ore),
  CONSTRAINT give_away_is_free CHECK (type <> 'give_away' OR
    (price_ore IS NULL AND declared_value_ore IS NULL AND deposit_ore IS NULL
     AND known_defects IS NOT NULL AND item_condition IS NOT NULL)),
  CONSTRAINT wanted_has_no_item_terms CHECK (type <> 'wanted' OR
    (declared_value_ore IS NULL AND deposit_ore IS NULL AND price_ore IS NULL)),
  CONSTRAINT wanted_dates_ordered CHECK (wanted_to IS NULL OR wanted_from IS NULL OR wanted_to >= wanted_from),
  CONSTRAINT not_wanted_fields_only_on_wanted CHECK (type = 'wanted' OR
    (wanted_from IS NULL AND wanted_to IS NULL AND budget_ore IS NULL)),
  CONSTRAINT delivery_fields_need_delivery CHECK (handover_owner_delivery OR
    (delivery_fee_ore IS NULL AND delivery_radius_km IS NULL)),
  CONSTRAINT published_offer_has_handover CHECK (type = 'wanted' OR status = 'draft' OR
    handover_pickup OR handover_owner_delivery OR handover_meet),
  CONSTRAINT reserved_only_for_give_away CHECK (status NOT IN ('reserved','given_away') OR type = 'give_away')
);
CREATE INDEX listings_browse_idx ON listings (status, type, category_id, locality_id, published_at DESC);
CREATE INDEX listings_owner_idx ON listings (owner_id, status);
CREATE INDEX listings_search_idx ON listings USING gin (search_vector);
CREATE INDEX listings_title_trgm_idx ON listings USING gin (title gin_trgm_ops);

CREATE TABLE listing_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  media_id    uuid NOT NULL REFERENCES media_objects(id),
  sort_order  smallint NOT NULL CHECK (sort_order BETWEEN 0 AND 7),   -- max 8 images
  alt_text    text CHECK (char_length(alt_text) <= 150),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, sort_order),
  UNIQUE (media_id)
);

-- Owner-blocked periods. A listing is available unless blocked or booked.
CREATE TABLE listing_unavailability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  period      tstzrange NOT NULL CHECK (NOT isempty(period) AND lower(period) IS NOT NULL AND upper(period) IS NOT NULL),
  note        text CHECK (char_length(note) <= 100),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_unavailability_idx ON listing_unavailability USING gist (listing_id, period);

CREATE TABLE saved_listings (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

-- -----------------------------------------------------------------------------
-- 4. Conversations and messages
-- -----------------------------------------------------------------------------

-- One conversation per (listing, interested user). Rental requests and giveaway
-- claims for that pair live in the same conversation.
CREATE TABLE conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       uuid NOT NULL REFERENCES listings(id),
  initiator_id     uuid NOT NULL REFERENCES users(id),
  listing_owner_id uuid NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, initiator_id),
  CHECK (initiator_id <> listing_owner_id)
);

CREATE TABLE conversation_participants (
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id),
  last_read_at     timestamptz,
  archived_at      timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id);

CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        uuid REFERENCES users(id),           -- NULL = system message
  kind             text NOT NULL DEFAULT 'user' CHECK (kind IN ('user','system')),
  body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  redacted_at      timestamptz,                          -- moderation or retention
  CHECK ((kind = 'system') = (sender_id IS NULL))
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- 5. Rentals (bookings), giveaways, agreements
-- -----------------------------------------------------------------------------

-- A rental request IS a booking in status 'requested' (DECISIONS D-013).
CREATE TABLE bookings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id             uuid NOT NULL REFERENCES listings(id),
  conversation_id        uuid NOT NULL REFERENCES conversations(id),
  owner_id               uuid NOT NULL REFERENCES users(id),
  renter_id              uuid NOT NULL REFERENCES users(id),
  status                 text NOT NULL DEFAULT 'requested' CHECK (status IN (
                           'requested','declined','withdrawn','expired',
                           'accepted','confirmed','cancelled',
                           'handed_over','return_pending','completed','disputed','not_returned')),
  period                 tstzrange NOT NULL CHECK (NOT isempty(period)
                           AND lower(period) IS NOT NULL AND upper(period) IS NOT NULL),
  -- Snapshot of the listing terms at request time (listing edits never change a booking)
  value_category         text NOT NULL CHECK (value_category IN ('A','B')),
  declared_value_ore     bigint NOT NULL CHECK (declared_value_ore > 0),
  price_ore              bigint NOT NULL CHECK (price_ore >= 0),
  price_unit             text NOT NULL CHECK (price_unit IN ('hour','day','weekend','week')),
  units                  integer NOT NULL CHECK (units BETWEEN 1 AND 366),
  total_price_ore        bigint NOT NULL CHECK (total_price_ore >= 0),
  deposit_ore            bigint NOT NULL DEFAULT 0 CHECK (deposit_ore >= 0),
  handover_method        text NOT NULL CHECK (handover_method IN ('pickup','owner_delivery','meet')),
  return_method          text NOT NULL CHECK (return_method IN ('pickup','owner_delivery','meet')),
  delivery_fee_ore       bigint CHECK (delivery_fee_ore >= 0),
  meeting_place_private  text CHECK (char_length(meeting_place_private) <= 200),  -- shown to the 2 parties only
  owner_response_due_at  timestamptz NOT NULL,
  agreement_due_at       timestamptz,
  decided_at             timestamptz,
  confirmed_at           timestamptz,
  handed_over_at         timestamptz,
  returned_at            timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  cancelled_by           uuid REFERENCES users(id),
  cancel_reason          text CHECK (char_length(cancel_reason) <= 500),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_id <> renter_id),
  CHECK (deposit_ore <= declared_value_ore),
  -- MVP gate (D-011): category B can never be stored as a booking until the
  -- constraint is replaced by a migration that ships with BankID + deposit procedure.
  CONSTRAINT mvp_category_a_only CHECK (value_category = 'A'),
  -- No two active bookings may overlap for the same listing.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (listing_id WITH =, period WITH &&)
    WHERE (status IN ('accepted','confirmed','handed_over','return_pending'))
);
CREATE INDEX bookings_owner_idx ON bookings (owner_id, status);
CREATE INDEX bookings_renter_idx ON bookings (renter_id, status);

-- Domain history of every state change, shown to both parties. Append-only.
CREATE TABLE booking_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES bookings(id),
  actor_id     uuid REFERENCES users(id),     -- NULL = system (worker)
  event        text NOT NULL,
  from_status  text,
  to_status    text NOT NULL,
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, created_at);

CREATE TABLE giveaway_claims (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       uuid NOT NULL REFERENCES listings(id),
  conversation_id  uuid NOT NULL REFERENCES conversations(id),
  giver_id         uuid NOT NULL REFERENCES users(id),
  claimant_id      uuid NOT NULL REFERENCES users(id),
  status           text NOT NULL DEFAULT 'requested' CHECK (status IN (
                     'requested','selected','declined','withdrawn','cancelled','expired','transferred')),
  handover_method  text CHECK (handover_method IN ('pickup','owner_delivery','meet')),
  selected_at      timestamptz,
  transferred_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, claimant_id),
  CHECK (giver_id <> claimant_id)
);
-- The giver can select only one claim at a time.
CREATE UNIQUE INDEX giveaway_one_selected ON giveaway_claims (listing_id)
  WHERE status IN ('selected','transferred');

CREATE SEQUENCE agreement_number_seq;

-- Rendered agreement / transfer-confirmation snapshots (immutable once created).
CREATE TABLE contracts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                 text NOT NULL CHECK (kind IN ('rental_simple','rental_extended','giveaway_transfer')),
  booking_id           uuid REFERENCES bookings(id),
  giveaway_claim_id    uuid REFERENCES giveaway_claims(id),
  template_version_id  uuid NOT NULL REFERENCES legal_document_versions(id),
  agreement_number     text NOT NULL UNIQUE,    -- e.g. LA-2026-000042 / GB-2026-000007
  revision             integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  terms                jsonb NOT NULL,          -- typed ContractTerms snapshot
  rendered_text        text NOT NULL,
  rendered_sha256      text NOT NULL CHECK (rendered_sha256 ~ '^[0-9a-f]{64}$'),
  status               text NOT NULL DEFAULT 'pending_acceptance'
                       CHECK (status IN ('pending_acceptance','accepted','superseded','void')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  superseded_at        timestamptz,
  CHECK ((booking_id IS NULL) <> (giveaway_claim_id IS NULL)),
  CHECK ((kind = 'giveaway_transfer') = (giveaway_claim_id IS NOT NULL))
);
CREATE UNIQUE INDEX contracts_booking_revision_uq ON contracts (booking_id, revision) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX contracts_one_live_per_booking ON contracts (booking_id)
  WHERE booking_id IS NOT NULL AND status IN ('pending_acceptance','accepted');

-- Each party's acceptance of one exact text (hash). Append-only.
CREATE TABLE contract_acceptances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      uuid NOT NULL REFERENCES contracts(id),
  user_id          uuid NOT NULL REFERENCES users(id),
  party_role       text NOT NULL CHECK (party_role IN ('owner','renter','giver','recipient')),
  accepted_sha256  text NOT NULL,
  accepted_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, user_id),
  UNIQUE (contract_id, party_role)
);

-- Defence in depth: an acceptance must match the contract text and come from the
-- right party. (The service layer checks this too.)
CREATE FUNCTION check_contract_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER contract_acceptance_guard BEFORE INSERT ON contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION check_contract_acceptance();

-- -----------------------------------------------------------------------------
-- 6. Condition reports (handover / return)
-- -----------------------------------------------------------------------------

CREATE TABLE condition_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid NOT NULL REFERENCES bookings(id),
  phase              text NOT NULL CHECK (phase IN ('handover','return')),
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open','agreed','contested','lapsed')),
  -- Return outcome (master spec §13 statuses), set only on phase = 'return'
  return_outcome     text CHECK (return_outcome IN (
                       'returned_ok','returned_normal_wear','returned_with_deviation',
                       'return_disputed','not_returned')),
  actual_returned_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  closed_at          timestamptz,
  UNIQUE (booking_id, phase),
  CHECK (phase = 'return' OR (return_outcome IS NULL AND actual_returned_at IS NULL))
);

-- Each party's own observations. Never updated; a correction is a new row that
-- supersedes an earlier row by the SAME author. Append-only.
CREATE TABLE condition_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid NOT NULL REFERENCES condition_reports(id),
  author_id             uuid NOT NULL REFERENCES users(id),
  author_role           text NOT NULL CHECK (author_role IN ('owner','renter')),
  seq                   integer NOT NULL CHECK (seq >= 1),   -- per report, increasing
  supersedes_entry_id   uuid REFERENCES condition_entries(id),
  overall_condition     text CHECK (overall_condition IN ('new','as_new','good','fair','worn','defective')),
  functional_status     text CHECK (functional_status IN ('works','works_with_remarks','not_working','not_tested')),
  existing_damage       text CHECK (char_length(existing_damage) <= 2000),
  new_damage            text CHECK (char_length(new_damage) <= 2000),
  accessories           jsonb NOT NULL DEFAULT '[]',   -- [{ "name": "Lader", "present": true }]
  fuel_or_battery       text CHECK (char_length(fuel_or_battery) <= 100),
  cleanliness           text CHECK (cleanliness IN ('clean','acceptable','needs_cleaning')),
  serial_or_identifier  text CHECK (char_length(serial_or_identifier) <= 100),
  notes                 text CHECK (char_length(notes) <= 2000),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, seq)
);

CREATE TABLE condition_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES condition_entries(id),
  media_id    uuid NOT NULL REFERENCES media_objects(id),
  caption     text CHECK (char_length(caption) <= 150),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id)
);

-- A confirmation is valid only for the entries that existed when it was made
-- (latest_entry_seq). Any newer entry invalidates it. Append-only.
CREATE TABLE condition_confirmations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid NOT NULL REFERENCES condition_reports(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  party_role        text NOT NULL CHECK (party_role IN ('owner','renter')),
  decision          text NOT NULL CHECK (decision IN ('confirm','contest')),
  checklist         jsonb NOT NULL DEFAULT '{}',  -- e.g. {"correct_item":true,"accessories_included":true,...}
  comment           text CHECK (char_length(comment) <= 2000),
  latest_entry_seq  integer NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX condition_confirmations_report_idx ON condition_confirmations (report_id, created_at);

-- -----------------------------------------------------------------------------
-- 7. Disputes
-- -----------------------------------------------------------------------------

CREATE TABLE disputes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             uuid NOT NULL REFERENCES bookings(id),
  opened_by              uuid NOT NULL REFERENCES users(id),
  respondent_id          uuid NOT NULL REFERENCES users(id),
  category               text NOT NULL CHECK (category IN (
                           'damaged','not_returned','not_as_described','missing_accessories',
                           'late_return','payment_disagreement','deposit_disagreement',
                           'unsafe_equipment','other')),
  status                 text NOT NULL DEFAULT 'awaiting_response' CHECK (status IN (
                           'awaiting_response','in_negotiation','support_review','awaiting_documentation',
                           'resolved_by_agreement','withdrawn','closed_without_agreement',
                           'referred_to_insurer','referred_to_authority')),
  summary                text NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 4000),
  response_due_at        timestamptz NOT NULL,
  escalated_at           timestamptz,
  escalated_by           uuid REFERENCES users(id),
  assigned_moderator_id  uuid REFERENCES users(id),
  opened_at              timestamptz NOT NULL DEFAULT now(),
  closed_at              timestamptz,
  closure_note           text CHECK (char_length(closure_note) <= 4000),
  CHECK (opened_by <> respondent_id)
);
-- One open case per booking at a time (it can cover several problems).
CREATE UNIQUE INDEX disputes_one_open_per_booking ON disputes (booking_id)
  WHERE status IN ('awaiting_response','in_negotiation','support_review','awaiting_documentation');

-- Statements, evidence, references, proposals, support notes. Append-only.
CREATE TABLE dispute_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  uuid NOT NULL REFERENCES disputes(id),
  actor_id    uuid REFERENCES users(id),           -- NULL = system
  kind        text NOT NULL CHECK (kind IN (
                'statement','evidence_photo','reference','proposal','proposal_response',
                'status_change','support_request','support_note','support_recommendation')),
  body        text CHECK (char_length(body) <= 4000),
  media_id    uuid REFERENCES media_objects(id),
  reference   jsonb,          -- {"type":"condition_report","id":"…"} | {"type":"message","id":"…"}
  visibility  text NOT NULL DEFAULT 'parties' CHECK (visibility IN ('parties','staff_only')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispute_events_dispute_idx ON dispute_events (dispute_id, created_at);

CREATE TABLE dispute_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      uuid NOT NULL REFERENCES disputes(id),
  proposer_id     uuid NOT NULL REFERENCES users(id),
  type            text NOT NULL CHECK (type IN (
                    'no_compensation','repair','replace_accessory','partial_compensation',
                    'full_compensation','extra_return_time','other')),
  amount_ore      bigint CHECK (amount_ore >= 0),
  new_return_at   timestamptz,
  text            text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','withdrawn','superseded')),
  responded_by    uuid REFERENCES users(id),
  responded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (type NOT IN ('partial_compensation','full_compensation') OR amount_ore IS NOT NULL),
  CHECK (type <> 'extra_return_time' OR new_return_at IS NOT NULL),
  CHECK (responded_by IS NULL OR responded_by <> proposer_id)
);

-- -----------------------------------------------------------------------------
-- 8. Reviews
-- -----------------------------------------------------------------------------

CREATE TABLE reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            uuid NOT NULL REFERENCES bookings(id),
  author_id             uuid NOT NULL REFERENCES users(id),
  subject_id            uuid NOT NULL REFERENCES users(id),
  author_role           text NOT NULL CHECK (author_role IN ('owner','renter')),
  rating_communication  smallint NOT NULL CHECK (rating_communication BETWEEN 1 AND 5),
  rating_punctuality    smallint NOT NULL CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_accuracy       smallint CHECK (rating_accuracy BETWEEN 1 AND 5),       -- renter → listing accuracy
  rating_item_condition smallint NOT NULL CHECK (rating_item_condition BETWEEN 1 AND 5),
  rating_agreement      smallint NOT NULL CHECK (rating_agreement BETWEEN 1 AND 5),
  comment               text CHECK (char_length(comment) <= 1000),
  status                text NOT NULL DEFAULT 'sealed' CHECK (status IN ('sealed','published','removed')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz,
  UNIQUE (booking_id, author_id),
  CHECK (author_id <> subject_id),
  CHECK ((author_role = 'renter') = (rating_accuracy IS NOT NULL))
);
CREATE INDEX reviews_subject_idx ON reviews (subject_id, status);

-- -----------------------------------------------------------------------------
-- 9. Reporting and moderation (notice-and-action)
-- -----------------------------------------------------------------------------

CREATE TABLE reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type           text NOT NULL CHECK (target_type IN ('listing','user','message','review','dispute')),
  target_id             uuid NOT NULL,
  reason                text NOT NULL CHECK (reason IN (
                          'prohibited_item','fraud_or_scam','misleading','harassment','spam',
                          'illegal_content','privacy','unsafe','fake_review','other')),
  details               text CHECK (char_length(details) <= 2000),
  attached_message_ids  uuid[] NOT NULL DEFAULT '{}',   -- reporter consents to share these
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','actioned','dismissed')),
  handled_by            uuid REFERENCES users(id),
  handled_at            timestamptz,
  decision_note         text CHECK (char_length(decision_note) <= 2000),
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_open_idx ON reports (status, created_at);

CREATE TABLE moderation_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id              uuid NOT NULL REFERENCES users(id),
  target_type           text NOT NULL CHECK (target_type IN ('listing','user','message','review')),
  target_id             uuid NOT NULL,
  action                text NOT NULL CHECK (action IN (
                          'listing_hidden','listing_restored','user_warned','user_restricted',
                          'user_suspended','user_reinstated','review_removed','review_restored',
                          'message_redacted')),
  reason_code           text NOT NULL,
  statement_of_reasons  text NOT NULL CHECK (char_length(statement_of_reasons) BETWEEN 10 AND 4000),
  report_id             uuid REFERENCES reports(id),
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE appeals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_action_id  uuid NOT NULL REFERENCES moderation_actions(id),
  appellant_id          uuid NOT NULL REFERENCES users(id),
  text                  text NOT NULL CHECK (char_length(text) BETWEEN 10 AND 4000),
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','upheld','reversed')),
  decided_by            uuid REFERENCES users(id),
  decision_text         text CHECK (char_length(decision_text) <= 4000),
  created_at            timestamptz NOT NULL DEFAULT now(),
  decided_at            timestamptz,
  UNIQUE (moderation_action_id, appellant_id)
);

-- Time-boxed, justified staff access to private material. Every use is audited.
CREATE TABLE support_access_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL REFERENCES users(id),
  scope        text NOT NULL CHECK (scope IN ('report_messages','dispute','condition_report')),
  target_id    uuid NOT NULL,
  reason       text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
  report_id    uuid REFERENCES reports(id),
  dispute_id   uuid REFERENCES disputes(id),
  granted_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  CHECK (report_id IS NOT NULL OR dispute_id IS NOT NULL),
  CHECK (expires_at > granted_at AND expires_at <= granted_at + interval '30 days')
);

-- -----------------------------------------------------------------------------
-- 10. Notifications, email, operations
-- -----------------------------------------------------------------------------

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',   -- ids and short labels only, no message text
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE email_outbox (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  to_email         text NOT NULL,
  template         text NOT NULL,
  locale           text NOT NULL CHECK (locale IN ('nb','en')),
  payload          jsonb NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts         smallint NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);
CREATE INDEX email_outbox_due_idx ON email_outbox (status, next_attempt_at);

CREATE TABLE feature_flags (
  key          text PRIMARY KEY,
  enabled      boolean NOT NULL,
  description  text NOT NULL,
  updated_by   uuid REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_rate_limits (
  bucket        text PRIMARY KEY,          -- e.g. 'msg:user:<uuid>:2026-12-14T10'
  count         integer NOT NULL,
  window_end    timestamptz NOT NULL
);

CREATE TABLE worker_heartbeats (
  job          text PRIMARY KEY,
  last_run_at  timestamptz NOT NULL,
  last_ok_at   timestamptz,
  last_error   text
);

-- Append-only security and admin log.
CREATE TABLE audit_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid,                       -- no FK: survives user deletion
  actor_role   text,
  action       text NOT NULL,              -- e.g. 'listing.publish', 'staff.view_dispute'
  target_type  text,
  target_id    uuid,
  reason       text,
  request_id   text,
  ip_hash      text,                       -- HMAC(ip, rotating key); never raw IP
  metadata     jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_events_target_idx ON audit_events (target_type, target_id);
CREATE INDEX audit_events_actor_idx ON audit_events (actor_id, occurred_at);

-- -----------------------------------------------------------------------------
-- 11. Database roles and privileges (D-022)
-- -----------------------------------------------------------------------------
-- laandet_owner : owns schema, runs migrations (not used by the running app)
-- laandet_app   : runtime role used by app + worker
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'laandet_app') THEN
    CREATE ROLE laandet_app NOLOGIN;  -- LOGIN + password set per environment
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO laandet_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO laandet_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO laandet_app;

-- Append-only evidence: no UPDATE / DELETE for the runtime role.
REVOKE UPDATE, DELETE ON
  audit_events, booking_events, contract_acceptances, condition_entries,
  condition_confirmations, condition_photos, dispute_events, legal_acceptances
FROM laandet_app;

-- Contracts: the app may only change status/superseded_at, never the text.
REVOKE UPDATE ON contracts FROM laandet_app;
GRANT UPDATE (status, superseded_at) ON contracts TO laandet_app;
REVOKE DELETE ON contracts FROM laandet_app;

-- Legal document versions are loaded at deploy by the owner role only.
REVOKE INSERT, UPDATE, DELETE ON legal_document_versions FROM laandet_app;

-- Retention (PRIVACY.md) runs through narrowly scoped SECURITY DEFINER functions
-- owned by laandet_owner, e.g. purge_expired_audit_events(), redact_message(id).
CREATE FUNCTION purge_expired_audit_events(retention interval DEFAULT interval '24 months')
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM audit_events WHERE occurred_at < now() - retention RETURNING 1)
  SELECT count(*)::integer FROM d;
$$;
REVOKE ALL ON FUNCTION purge_expired_audit_events(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_audit_events(interval) TO laandet_app;
