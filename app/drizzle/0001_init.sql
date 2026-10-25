CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_rate_limits" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_end" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"reason" text,
	"request_id" text,
	"ip_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_user_id" uuid,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"locale" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_outbox_status_chk" CHECK ("email_outbox"."status" IN ('pending','sending','sent','failed'))
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"description" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"level" text NOT NULL,
	"status" text NOT NULL,
	"provider_subject_hash" text,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_provider_chk" CHECK ("identity_verifications"."provider" IN ('email','bankid','manual_staff')),
	CONSTRAINT "identity_level_chk" CHECK ("identity_verifications"."level" IN ('basic','strong')),
	CONSTRAINT "identity_status_chk" CHECK ("identity_verifications"."status" IN ('pending','verified','failed','revoked','expired')),
	CONSTRAINT "identity_email_is_basic" CHECK ("identity_verifications"."level" = 'basic' OR "identity_verifications"."provider" <> 'email')
);
--> statement-breakpoint
CREATE TABLE "localities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"municipality" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "localities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "localities_slug_chk" CHECK ("localities"."slug" ~ '^[a-z0-9-]+$')
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "user_blocks_not_self" CHECK ("user_blocks"."blocker_id" <> "user_blocks"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"locality_id" uuid,
	"bio" text,
	"locale" text DEFAULT 'nb' NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"status_reason_code" text,
	"status_changed_at" timestamp with time zone,
	"age_18_confirmed_at" timestamp with time zone NOT NULL,
	"private_use_confirmed_at" timestamp with time zone NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_bio_len" CHECK (char_length("user_profiles"."bio") <= 500),
	CONSTRAINT "user_profiles_locale_chk" CHECK ("user_profiles"."locale" IN ('nb','en')),
	CONSTRAINT "user_profiles_role_chk" CHECK ("user_profiles"."role" IN ('user','moderator','admin')),
	CONSTRAINT "user_profiles_status_chk" CHECK ("user_profiles"."status" IN ('active','restricted','suspended','deletion_pending','deleted'))
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"job" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_acceptance_uq" UNIQUE("user_id","document_version_id")
);
--> statement-breakpoint
CREATE TABLE "legal_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_key" text NOT NULL,
	"locale" text NOT NULL,
	"version" text NOT NULL,
	"is_authoritative" boolean NOT NULL,
	"is_draft" boolean DEFAULT true NOT NULL,
	"material_change" boolean DEFAULT false NOT NULL,
	"content_md" text NOT NULL,
	"content_sha256" text NOT NULL,
	"published_at" timestamp with time zone,
	"effective_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_doc_version_uq" UNIQUE("doc_key","locale","version","content_sha256"),
	CONSTRAINT "legal_sha_chk" CHECK ("legal_document_versions"."content_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "legal_authoritative_chk" CHECK ("legal_document_versions"."is_authoritative" = ("legal_document_versions"."locale" = 'nb'))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"labels" jsonb NOT NULL,
	"icon" text DEFAULT 'box' NOT NULL,
	"policy" text DEFAULT 'allowed' NOT NULL,
	"safety_notice" jsonb,
	"allowed_listing_types" text[] DEFAULT ARRAY['rent_out','wanted','give_away'] NOT NULL,
	"allow_paid_rental" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_slug_chk" CHECK ("categories"."slug" ~ '^[a-z0-9-]+$'),
	CONSTRAINT "categories_labels_chk" CHECK ("categories"."labels" ? 'nb' AND "categories"."labels" ? 'en'),
	CONSTRAINT "categories_policy_chk" CHECK ("categories"."policy" IN ('allowed','restricted','prohibited')),
	CONSTRAINT "categories_restricted_has_notice" CHECK ("categories"."policy" <> 'restricted' OR "categories"."safety_notice" IS NOT NULL),
	CONSTRAINT "categories_types_chk" CHECK ("categories"."allowed_listing_types" <@ ARRAY['rent_out','wanted','give_away'])
);
--> statement-breakpoint
CREATE TABLE "category_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"text" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_suggestions_len" CHECK (char_length("category_suggestions"."text") BETWEEN 2 AND 200)
);
--> statement-breakpoint
CREATE TABLE "listing_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" smallint NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_images_media_id_unique" UNIQUE("media_id"),
	CONSTRAINT "listing_images_order_uq" UNIQUE("listing_id","sort_order"),
	CONSTRAINT "listing_images_order_chk" CHECK ("listing_images"."sort_order" BETWEEN 0 AND 7),
	CONSTRAINT "listing_images_alt_len" CHECK (char_length("listing_images"."alt_text") <= 150)
);
--> statement-breakpoint
CREATE TABLE "listing_unavailability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"period" "tstzrange" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_unavailability_period_chk" CHECK (NOT isempty("listing_unavailability"."period") AND lower("listing_unavailability"."period") IS NOT NULL AND upper("listing_unavailability"."period") IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category_id" uuid NOT NULL,
	"locality_id" uuid NOT NULL,
	"area_note" text,
	"item_condition" text,
	"known_defects" text,
	"price_ore" bigint,
	"price_unit" text,
	"declared_value_ore" bigint,
	"value_category" text GENERATED ALWAYS AS (CASE WHEN type = 'rent_out' AND declared_value_ore IS NOT NULL THEN CASE WHEN declared_value_ore <= 500000 THEN 'A' ELSE 'B' END END) STORED,
	"deposit_ore" bigint,
	"usage_restrictions" text,
	"included_accessories" text[] DEFAULT '{}'::text[] NOT NULL,
	"operating_instructions" text,
	"restricted_ack_at" timestamp with time zone,
	"wanted_from" date,
	"wanted_to" date,
	"budget_ore" bigint,
	"handover_pickup" boolean DEFAULT false NOT NULL,
	"handover_owner_delivery" boolean DEFAULT false NOT NULL,
	"delivery_fee_ore" bigint,
	"delivery_radius_km" integer,
	"handover_meet" boolean DEFAULT false NOT NULL,
	"meeting_area_note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('norwegian', coalesce(title, '')), 'A') || setweight(to_tsvector('norwegian', coalesce(description, '')), 'B') || setweight(to_tsvector('simple', coalesce(title, '')), 'C')) STORED,
	CONSTRAINT "listings_type_chk" CHECK ("listings"."type" IN ('rent_out','wanted','give_away')),
	CONSTRAINT "listings_status_chk" CHECK ("listings"."status" IN ('draft','published','paused','reserved','given_away','archived','removed','deleted')),
	CONSTRAINT "listings_title_len" CHECK (char_length("listings"."title") BETWEEN 3 AND 90),
	CONSTRAINT "listings_description_len" CHECK (char_length("listings"."description") <= 4000 AND ("listings"."status" = 'draft' OR char_length("listings"."description") >= 10)),
	CONSTRAINT "listings_area_note_len" CHECK (char_length("listings"."area_note") <= 80),
	CONSTRAINT "listings_meeting_note_len" CHECK (char_length("listings"."meeting_area_note") <= 80),
	CONSTRAINT "listings_defects_len" CHECK (char_length("listings"."known_defects") <= 1000),
	CONSTRAINT "listings_restrictions_len" CHECK (char_length("listings"."usage_restrictions") <= 1000),
	CONSTRAINT "listings_instructions_len" CHECK (char_length("listings"."operating_instructions") <= 2000),
	CONSTRAINT "listings_condition_chk" CHECK ("listings"."item_condition" IN ('new','as_new','good','fair','worn','defective')),
	CONSTRAINT "listings_price_unit_chk" CHECK ("listings"."price_unit" IN ('hour','day','weekend','week')),
	CONSTRAINT "listings_money_nonneg" CHECK (coalesce("listings"."price_ore", 0) >= 0 AND coalesce("listings"."deposit_ore", 0) >= 0 AND coalesce("listings"."budget_ore", 0) >= 0 AND coalesce("listings"."delivery_fee_ore", 0) >= 0 AND coalesce("listings"."declared_value_ore", 1) > 0),
	CONSTRAINT "listings_radius_chk" CHECK ("listings"."delivery_radius_km" BETWEEN 1 AND 300),
	CONSTRAINT "rent_out_requires_terms" CHECK ("listings"."type" <> 'rent_out' OR "listings"."status" = 'draft' OR ("listings"."price_ore" IS NOT NULL AND "listings"."price_unit" IS NOT NULL AND "listings"."declared_value_ore" IS NOT NULL AND "listings"."item_condition" IS NOT NULL)),
	CONSTRAINT "deposit_not_above_value" CHECK ("listings"."deposit_ore" IS NULL OR "listings"."declared_value_ore" IS NULL OR "listings"."deposit_ore" <= "listings"."declared_value_ore"),
	CONSTRAINT "give_away_is_free" CHECK ("listings"."type" <> 'give_away' OR ("listings"."price_ore" IS NULL AND "listings"."declared_value_ore" IS NULL AND "listings"."deposit_ore" IS NULL)),
	CONSTRAINT "give_away_states_condition" CHECK ("listings"."type" <> 'give_away' OR "listings"."status" = 'draft' OR ("listings"."known_defects" IS NOT NULL AND "listings"."item_condition" IS NOT NULL)),
	CONSTRAINT "wanted_has_no_item_terms" CHECK ("listings"."type" <> 'wanted' OR ("listings"."declared_value_ore" IS NULL AND "listings"."deposit_ore" IS NULL AND "listings"."price_ore" IS NULL)),
	CONSTRAINT "wanted_dates_ordered" CHECK ("listings"."wanted_to" IS NULL OR "listings"."wanted_from" IS NULL OR "listings"."wanted_to" >= "listings"."wanted_from"),
	CONSTRAINT "not_wanted_fields_only_on_wanted" CHECK ("listings"."type" = 'wanted' OR ("listings"."wanted_from" IS NULL AND "listings"."wanted_to" IS NULL AND "listings"."budget_ore" IS NULL)),
	CONSTRAINT "delivery_fields_need_delivery" CHECK ("listings"."handover_owner_delivery" OR ("listings"."delivery_fee_ore" IS NULL AND "listings"."delivery_radius_km" IS NULL)),
	CONSTRAINT "published_offer_has_handover" CHECK ("listings"."type" = 'wanted' OR "listings"."status" = 'draft' OR "listings"."handover_pickup" OR "listings"."handover_owner_delivery" OR "listings"."handover_meet"),
	CONSTRAINT "reserved_only_for_give_away" CHECK ("listings"."status" NOT IN ('reserved','given_away') OR "listings"."type" = 'give_away')
);
--> statement-breakpoint
CREATE TABLE "media_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" uuid,
	"scope" text NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_objects_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_objects_thumb_key_unique" UNIQUE("thumb_key"),
	CONSTRAINT "media_scope_chk" CHECK ("media_objects"."scope" IN ('listing','condition','dispute')),
	CONSTRAINT "media_mime_chk" CHECK ("media_objects"."mime_type" = 'image/webp'),
	CONSTRAINT "media_bytes_chk" CHECK ("media_objects"."bytes" > 0 AND "media_objects"."bytes" <= 5000000),
	CONSTRAINT "media_dims_chk" CHECK ("media_objects"."width" BETWEEN 1 AND 4000 AND "media_objects"."height" BETWEEN 1 AND 4000),
	CONSTRAINT "media_sha_chk" CHECK ("media_objects"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "saved_listings" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_listings_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "screening_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screening_keywords_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderation_action_id" uuid NOT NULL,
	"appellant_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decided_by" uuid,
	"decision_text" text,
	"decided_by_same_staff" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "appeals_once_uq" UNIQUE("moderation_action_id","appellant_id"),
	CONSTRAINT "appeals_text_len" CHECK (char_length("appeals"."text") BETWEEN 10 AND 4000),
	CONSTRAINT "appeals_decision_len" CHECK (char_length("appeals"."decision_text") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason_code" text NOT NULL,
	"statement_of_reasons" text NOT NULL,
	"report_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_statement_len" CHECK (char_length("moderation_actions"."statement_of_reasons") BETWEEN 10 AND 4000)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"is_automatic" boolean DEFAULT false NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"attached_message_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_details_len" CHECK (char_length("reports"."details") <= 2000),
	CONSTRAINT "reports_decision_len" CHECK (char_length("reports"."decision_note") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_document_version_id_legal_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."legal_document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_unavailability" ADD CONSTRAINT "listing_unavailability_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_keywords" ADD CONSTRAINT "screening_keywords_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_moderation_action_id_moderation_actions_id_fk" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_appellant_id_users_id_fk" FOREIGN KEY ("appellant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factors_user_idx" ON "two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factors_secret_idx" ON "two_factors" USING btree ("secret");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_outbox_due_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_unique_subject" ON "identity_verifications" USING btree ("provider","provider_subject_hash") WHERE status = 'verified' AND provider_subject_hash IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "listing_unavailability_idx" ON "listing_unavailability" USING gist ("listing_id","period");--> statement-breakpoint
CREATE INDEX "listings_browse_idx" ON "listings" USING btree ("status","type","category_id","locality_id","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "listings_search_idx" ON "listings" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "listings_title_trgm_idx" ON "listings" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "reports" USING btree ("status","created_at");