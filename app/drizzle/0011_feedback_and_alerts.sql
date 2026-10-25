CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"page_path" text,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_kind_chk" CHECK ("feedback"."kind" IN ('error','suggestion','other')),
	CONSTRAINT "feedback_status_chk" CHECK ("feedback"."status" IN ('open','handled')),
	CONSTRAINT "feedback_body_len" CHECK (char_length("feedback"."body") BETWEEN 3 AND 2000),
	CONSTRAINT "feedback_path_len" CHECK (char_length("feedback"."page_path") <= 300)
);
--> statement-breakpoint
ALTER TABLE "worker_heartbeats" ADD COLUMN "fail_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_heartbeats" ADD COLUMN "alerting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "worker_heartbeats" ADD COLUMN "alerted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status","created_at");