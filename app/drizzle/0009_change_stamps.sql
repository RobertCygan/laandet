ALTER TABLE "user_profiles" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "last_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "last_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "last_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "last_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "giveaway_claims" ADD COLUMN "last_changed_at" timestamp with time zone DEFAULT now() NOT NULL;