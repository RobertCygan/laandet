CREATE SEQUENCE "public"."agreement_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_id" uuid,
	"event" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"renter_id" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"period" "tstzrange" NOT NULL,
	"value_category" text NOT NULL,
	"declared_value_ore" bigint NOT NULL,
	"price_ore" bigint NOT NULL,
	"price_unit" text NOT NULL,
	"units" integer NOT NULL,
	"total_price_ore" bigint NOT NULL,
	"deposit_ore" bigint DEFAULT 0 NOT NULL,
	"handover_method" text NOT NULL,
	"return_method" text NOT NULL,
	"delivery_fee_ore" bigint,
	"meeting_place_private" text,
	"owner_response_due_at" timestamp with time zone NOT NULL,
	"agreement_due_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"handed_over_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_status_chk" CHECK ("bookings"."status" IN ('requested','declined','withdrawn','expired','accepted','confirmed','cancelled','handed_over','return_pending','completed','disputed','not_returned')),
	CONSTRAINT "bookings_period_chk" CHECK (NOT isempty("bookings"."period") AND lower("bookings"."period") IS NOT NULL AND upper("bookings"."period") IS NOT NULL),
	CONSTRAINT "bookings_not_self" CHECK ("bookings"."owner_id" <> "bookings"."renter_id"),
	CONSTRAINT "bookings_value_category_chk" CHECK ("bookings"."value_category" IN ('A','B')),
	CONSTRAINT "mvp_category_a_only" CHECK ("bookings"."value_category" = 'A'),
	CONSTRAINT "bookings_money_chk" CHECK ("bookings"."declared_value_ore" > 0 AND "bookings"."price_ore" >= 0 AND "bookings"."total_price_ore" >= 0 AND "bookings"."deposit_ore" >= 0 AND coalesce("bookings"."delivery_fee_ore", 0) >= 0),
	CONSTRAINT "bookings_deposit_le_value" CHECK ("bookings"."deposit_ore" <= "bookings"."declared_value_ore"),
	CONSTRAINT "bookings_units_chk" CHECK ("bookings"."units" BETWEEN 1 AND 366),
	CONSTRAINT "bookings_price_unit_chk" CHECK ("bookings"."price_unit" IN ('hour','day','weekend','week')),
	CONSTRAINT "bookings_methods_chk" CHECK ("bookings"."handover_method" IN ('pickup','owner_delivery','meet') AND "bookings"."return_method" IN ('pickup','owner_delivery','meet')),
	CONSTRAINT "bookings_meeting_place_len" CHECK (char_length("bookings"."meeting_place_private") <= 200),
	CONSTRAINT "bookings_cancel_reason_len" CHECK (char_length("bookings"."cancel_reason") <= 500)
);
--> statement-breakpoint
CREATE TABLE "condition_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"party_role" text NOT NULL,
	"decision" text NOT NULL,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comment" text,
	"latest_entry_seq" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_confirmations_role_chk" CHECK ("condition_confirmations"."party_role" IN ('owner','renter')),
	CONSTRAINT "condition_confirmations_decision_chk" CHECK ("condition_confirmations"."decision" IN ('confirm','contest')),
	CONSTRAINT "condition_confirmations_comment_len" CHECK (char_length("condition_confirmations"."comment") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "condition_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_role" text NOT NULL,
	"seq" integer NOT NULL,
	"supersedes_entry_id" uuid,
	"overall_condition" text,
	"functional_status" text,
	"existing_damage" text,
	"new_damage" text,
	"accessories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fuel_or_battery" text,
	"cleanliness" text,
	"serial_or_identifier" text,
	"proposed_outcome" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_entries_report_seq_uq" UNIQUE("report_id","seq"),
	CONSTRAINT "condition_entries_role_chk" CHECK ("condition_entries"."author_role" IN ('owner','renter')),
	CONSTRAINT "condition_entries_seq_chk" CHECK ("condition_entries"."seq" >= 1),
	CONSTRAINT "condition_entries_condition_chk" CHECK ("condition_entries"."overall_condition" IS NULL OR "condition_entries"."overall_condition" IN ('new','as_new','good','fair','worn','defective')),
	CONSTRAINT "condition_entries_functional_chk" CHECK ("condition_entries"."functional_status" IS NULL OR "condition_entries"."functional_status" IN ('works','works_with_remarks','not_working','not_tested')),
	CONSTRAINT "condition_entries_cleanliness_chk" CHECK ("condition_entries"."cleanliness" IS NULL OR "condition_entries"."cleanliness" IN ('clean','acceptable','needs_cleaning')),
	CONSTRAINT "condition_entries_text_len" CHECK (coalesce(char_length("condition_entries"."existing_damage"), 0) <= 2000 AND coalesce(char_length("condition_entries"."new_damage"), 0) <= 2000 AND coalesce(char_length("condition_entries"."notes"), 0) <= 2000 AND coalesce(char_length("condition_entries"."fuel_or_battery"), 0) <= 100 AND coalesce(char_length("condition_entries"."serial_or_identifier"), 0) <= 100)
);
--> statement-breakpoint
CREATE TABLE "condition_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_photos_media_id_unique" UNIQUE("media_id"),
	CONSTRAINT "condition_photos_caption_len" CHECK (char_length("condition_photos"."caption") <= 150)
);
--> statement-breakpoint
CREATE TABLE "condition_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"return_outcome" text,
	"actual_returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "condition_reports_booking_phase_uq" UNIQUE("booking_id","phase"),
	CONSTRAINT "condition_reports_phase_chk" CHECK ("condition_reports"."phase" IN ('handover','return')),
	CONSTRAINT "condition_reports_status_chk" CHECK ("condition_reports"."status" IN ('open','agreed','contested','lapsed')),
	CONSTRAINT "condition_reports_outcome_chk" CHECK ("condition_reports"."return_outcome" IS NULL OR "condition_reports"."return_outcome" IN ('returned_ok','returned_normal_wear','returned_with_deviation','return_disputed','not_returned')),
	CONSTRAINT "condition_reports_return_fields" CHECK ("condition_reports"."phase" = 'return' OR ("condition_reports"."return_outcome" IS NULL AND "condition_reports"."actual_returned_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "contract_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"party_role" text NOT NULL,
	"accepted_sha256" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_acceptances_user_uq" UNIQUE("contract_id","user_id"),
	CONSTRAINT "contract_acceptances_role_uq" UNIQUE("contract_id","party_role"),
	CONSTRAINT "contract_acceptances_role_chk" CHECK ("contract_acceptances"."party_role" IN ('owner','renter','giver','recipient'))
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"booking_id" uuid,
	"giveaway_claim_id" uuid,
	"template_version_id" uuid NOT NULL,
	"agreement_number" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"terms" jsonb NOT NULL,
	"rendered_text" text NOT NULL,
	"rendered_sha256" text NOT NULL,
	"status" text DEFAULT 'pending_acceptance' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "contracts_agreement_number_unique" UNIQUE("agreement_number"),
	CONSTRAINT "contracts_kind_chk" CHECK ("contracts"."kind" IN ('rental_simple','rental_extended','giveaway_transfer')),
	CONSTRAINT "contracts_revision_chk" CHECK ("contracts"."revision" >= 1),
	CONSTRAINT "contracts_sha_chk" CHECK ("contracts"."rendered_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "contracts_status_chk" CHECK ("contracts"."status" IN ('pending_acceptance','accepted','superseded','void')),
	CONSTRAINT "contracts_one_parent" CHECK (("contracts"."booking_id" IS NULL) <> ("contracts"."giveaway_claim_id" IS NULL)),
	CONSTRAINT "contracts_giveaway_kind" CHECK (("contracts"."kind" = 'giveaway_transfer') = ("contracts"."giveaway_claim_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"last_emailed_at" timestamp with time zone,
	CONSTRAINT "conversation_participants_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"initiator_id" uuid NOT NULL,
	"listing_owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_listing_initiator_uq" UNIQUE("listing_id","initiator_id"),
	CONSTRAINT "conversations_not_self" CHECK ("conversations"."initiator_id" <> "conversations"."listing_owner_id")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"respondent_id" uuid NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'awaiting_response' NOT NULL,
	"summary" text NOT NULL,
	"response_due_at" timestamp with time zone NOT NULL,
	"escalated_at" timestamp with time zone,
	"escalated_by" uuid,
	"assigned_moderator_id" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closure_note" text,
	CONSTRAINT "disputes_not_self" CHECK ("disputes"."opened_by" <> "disputes"."respondent_id"),
	CONSTRAINT "disputes_summary_len" CHECK (char_length("disputes"."summary") BETWEEN 10 AND 4000),
	CONSTRAINT "disputes_category_chk" CHECK ("disputes"."category" IN ('damaged','not_returned','not_as_described','missing_accessories','late_return','payment_disagreement','deposit_disagreement','unsafe_equipment','other')),
	CONSTRAINT "disputes_status_chk" CHECK ("disputes"."status" IN ('awaiting_response','in_negotiation','support_review','awaiting_documentation','resolved_by_agreement','withdrawn','closed_without_agreement','referred_to_insurer','referred_to_authority'))
);
--> statement-breakpoint
CREATE TABLE "giveaway_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"giver_id" uuid NOT NULL,
	"claimant_id" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"handover_method" text,
	"selected_at" timestamp with time zone,
	"transferred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "giveaway_claims_listing_claimant_uq" UNIQUE("listing_id","claimant_id"),
	CONSTRAINT "giveaway_claims_not_self" CHECK ("giveaway_claims"."giver_id" <> "giveaway_claims"."claimant_id"),
	CONSTRAINT "giveaway_claims_status_chk" CHECK ("giveaway_claims"."status" IN ('requested','selected','declined','withdrawn','cancelled','expired','transferred')),
	CONSTRAINT "giveaway_claims_method_chk" CHECK ("giveaway_claims"."handover_method" IS NULL OR "giveaway_claims"."handover_method" IN ('pickup','owner_delivery','meet'))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"kind" text DEFAULT 'user' NOT NULL,
	"body" text NOT NULL,
	"attached_listing_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redacted_at" timestamp with time zone,
	CONSTRAINT "messages_kind_chk" CHECK ("messages"."kind" IN ('user','system')),
	CONSTRAINT "messages_body_len" CHECK (char_length("messages"."body") BETWEEN 1 AND 4000),
	CONSTRAINT "messages_system_has_no_sender" CHECK (("messages"."kind" = 'system') = ("messages"."sender_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renter_id_users_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_confirmations" ADD CONSTRAINT "condition_confirmations_report_id_condition_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."condition_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_confirmations" ADD CONSTRAINT "condition_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_entries" ADD CONSTRAINT "condition_entries_report_id_condition_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."condition_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_entries" ADD CONSTRAINT "condition_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_photos" ADD CONSTRAINT "condition_photos_entry_id_condition_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."condition_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_photos" ADD CONSTRAINT "condition_photos_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_giveaway_claim_id_giveaway_claims_id_fk" FOREIGN KEY ("giveaway_claim_id") REFERENCES "public"."giveaway_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_version_id_legal_document_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."legal_document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_owner_id_users_id_fk" FOREIGN KEY ("listing_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_respondent_id_users_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_escalated_by_users_id_fk" FOREIGN KEY ("escalated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_moderator_id_users_id_fk" FOREIGN KEY ("assigned_moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_claims" ADD CONSTRAINT "giveaway_claims_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_claims" ADD CONSTRAINT "giveaway_claims_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_claims" ADD CONSTRAINT "giveaway_claims_giver_id_users_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_claims" ADD CONSTRAINT "giveaway_claims_claimant_id_users_id_fk" FOREIGN KEY ("claimant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_attached_listing_id_listings_id_fk" FOREIGN KEY ("attached_listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_owner_idx" ON "bookings" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "bookings_renter_idx" ON "bookings" USING btree ("renter_id","status");--> statement-breakpoint
CREATE INDEX "bookings_listing_idx" ON "bookings" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "condition_confirmations_report_idx" ON "condition_confirmations" USING btree ("report_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_booking_revision_uq" ON "contracts" USING btree ("booking_id","revision") WHERE "contracts"."booking_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_one_live_per_booking" ON "contracts" USING btree ("booking_id") WHERE "contracts"."booking_id" IS NOT NULL AND "contracts"."status" IN ('pending_acceptance','accepted');--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_one_live_per_claim" ON "contracts" USING btree ("giveaway_claim_id") WHERE "contracts"."giveaway_claim_id" IS NOT NULL AND "contracts"."status" IN ('pending_acceptance','accepted');--> statement-breakpoint
CREATE INDEX "conversation_participants_user_idx" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_one_open_per_booking" ON "disputes" USING btree ("booking_id") WHERE "disputes"."status" IN ('awaiting_response','in_negotiation','support_review','awaiting_documentation');--> statement-breakpoint
CREATE UNIQUE INDEX "giveaway_one_selected" ON "giveaway_claims" USING btree ("listing_id") WHERE "giveaway_claims"."status" IN ('selected','transferred');--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");