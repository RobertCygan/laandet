CREATE TABLE "dispute_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"actor_id" uuid,
	"kind" text NOT NULL,
	"body" text,
	"media_id" uuid,
	"reference" jsonb,
	"visibility" text DEFAULT 'parties' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_events_kind_chk" CHECK ("dispute_events"."kind" IN ('statement','evidence_photo','reference','proposal','proposal_response','status_change','support_request','support_note','support_recommendation')),
	CONSTRAINT "dispute_events_body_len" CHECK (char_length("dispute_events"."body") <= 4000),
	CONSTRAINT "dispute_events_visibility_chk" CHECK ("dispute_events"."visibility" IN ('parties','staff_only')),
	CONSTRAINT "dispute_events_photo_chk" CHECK ("dispute_events"."kind" <> 'evidence_photo' OR "dispute_events"."media_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "dispute_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"proposer_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount_ore" bigint,
	"new_return_at" timestamp with time zone,
	"text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_by" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_proposals_type_chk" CHECK ("dispute_proposals"."type" IN ('no_compensation','repair','replace_accessory','partial_compensation','full_compensation','extra_return_time','other')),
	CONSTRAINT "dispute_proposals_status_chk" CHECK ("dispute_proposals"."status" IN ('pending','accepted','rejected','withdrawn','superseded')),
	CONSTRAINT "dispute_proposals_text_len" CHECK (char_length("dispute_proposals"."text") BETWEEN 1 AND 2000),
	CONSTRAINT "dispute_proposals_amount_chk" CHECK ("dispute_proposals"."amount_ore" IS NULL OR "dispute_proposals"."amount_ore" BETWEEN 0 AND 100000000),
	CONSTRAINT "dispute_proposals_amount_required" CHECK ("dispute_proposals"."type" NOT IN ('partial_compensation','full_compensation') OR "dispute_proposals"."amount_ore" IS NOT NULL),
	CONSTRAINT "dispute_proposals_time_required" CHECK ("dispute_proposals"."type" <> 'extra_return_time' OR "dispute_proposals"."new_return_at" IS NOT NULL),
	CONSTRAINT "dispute_proposals_not_own" CHECK ("dispute_proposals"."responded_by" IS NULL OR "dispute_proposals"."responded_by" <> "dispute_proposals"."proposer_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"author_role" text NOT NULL,
	"rating_communication" smallint NOT NULL,
	"rating_punctuality" smallint NOT NULL,
	"rating_accuracy" smallint,
	"rating_item_condition" smallint NOT NULL,
	"rating_agreement" smallint NOT NULL,
	"comment" text,
	"status" text DEFAULT 'sealed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "reviews_booking_author_uq" UNIQUE("booking_id","author_id"),
	CONSTRAINT "reviews_not_self" CHECK ("reviews"."author_id" <> "reviews"."subject_id"),
	CONSTRAINT "reviews_role_chk" CHECK ("reviews"."author_role" IN ('owner','renter')),
	CONSTRAINT "reviews_status_chk" CHECK ("reviews"."status" IN ('sealed','published','removed')),
	CONSTRAINT "reviews_ratings_chk" CHECK ("reviews"."rating_communication" BETWEEN 1 AND 5 AND "reviews"."rating_punctuality" BETWEEN 1 AND 5 AND "reviews"."rating_item_condition" BETWEEN 1 AND 5 AND "reviews"."rating_agreement" BETWEEN 1 AND 5 AND ("reviews"."rating_accuracy" IS NULL OR "reviews"."rating_accuracy" BETWEEN 1 AND 5)),
	CONSTRAINT "reviews_accuracy_role" CHECK (("reviews"."author_role" = 'renter') = ("reviews"."rating_accuracy" IS NOT NULL)),
	CONSTRAINT "reviews_comment_len" CHECK (char_length("reviews"."comment") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "support_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"report_id" uuid,
	"dispute_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "support_access_grants_scope_chk" CHECK ("support_access_grants"."scope" IN ('report_messages','dispute','condition_report')),
	CONSTRAINT "support_access_grants_reason_len" CHECK (char_length("support_access_grants"."reason") BETWEEN 10 AND 500),
	CONSTRAINT "support_access_grants_link_chk" CHECK ("support_access_grants"."report_id" IS NOT NULL OR "support_access_grants"."dispute_id" IS NOT NULL),
	CONSTRAINT "support_access_grants_window_chk" CHECK ("support_access_grants"."expires_at" > "support_access_grants"."granted_at" AND "support_access_grants"."expires_at" <= "support_access_grants"."granted_at" + interval '30 days')
);
--> statement-breakpoint
CREATE TABLE "transparency_months" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"cost_total_ore" bigint NOT NULL,
	"cost_server_ore" bigint,
	"cost_backup_ore" bigint,
	"cost_email_ore" bigint,
	"cost_domain_ore" bigint,
	"cost_other_ore" bigint,
	"support_received_ore" bigint,
	"note" text,
	"source_note" text,
	"entered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transparency_months_month_unique" UNIQUE("month"),
	CONSTRAINT "transparency_month_first_day" CHECK (extract(day from "transparency_months"."month") = 1),
	CONSTRAINT "transparency_amounts_chk" CHECK ("transparency_months"."cost_total_ore" >= 0 AND coalesce("transparency_months"."cost_server_ore", 0) >= 0 AND coalesce("transparency_months"."cost_backup_ore", 0) >= 0 AND coalesce("transparency_months"."cost_email_ore", 0) >= 0 AND coalesce("transparency_months"."cost_domain_ore", 0) >= 0 AND coalesce("transparency_months"."cost_other_ore", 0) >= 0 AND coalesce("transparency_months"."support_received_ore", 0) >= 0),
	CONSTRAINT "transparency_parts_le_total" CHECK (coalesce("transparency_months"."cost_server_ore", 0) + coalesce("transparency_months"."cost_backup_ore", 0) + coalesce("transparency_months"."cost_email_ore", 0) + coalesce("transparency_months"."cost_domain_ore", 0) + coalesce("transparency_months"."cost_other_ore", 0) <= "transparency_months"."cost_total_ore"),
	CONSTRAINT "transparency_note_len" CHECK (char_length("transparency_months"."note") <= 500),
	CONSTRAINT "transparency_source_len" CHECK (char_length("transparency_months"."source_note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "reported_late" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "reopened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_media_id_media_objects_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_proposals" ADD CONSTRAINT "dispute_proposals_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_proposals" ADD CONSTRAINT "dispute_proposals_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_proposals" ADD CONSTRAINT "dispute_proposals_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transparency_months" ADD CONSTRAINT "transparency_months_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_events_dispute_idx" ON "dispute_events" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "dispute_proposals_dispute_idx" ON "dispute_proposals" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_subject_idx" ON "reviews" USING btree ("subject_id","status");--> statement-breakpoint
CREATE INDEX "support_access_grants_lookup_idx" ON "support_access_grants" USING btree ("staff_id","scope","target_id","expires_at");--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_closure_note_len" CHECK (char_length("disputes"."closure_note") <= 4000);