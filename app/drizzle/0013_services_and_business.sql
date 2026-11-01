ALTER TABLE "categories" DROP CONSTRAINT "categories_types_chk";--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listings_type_chk";--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listings_price_unit_chk";--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "published_offer_has_handover";--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "private_use_confirmed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "account_type" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "org_number" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "business_name" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "business_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_org_number_uq" ON "user_profiles" USING btree ("org_number");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_account_type_chk" CHECK ("user_profiles"."account_type" IN ('private','business'));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_account_kind_chk" CHECK (("user_profiles"."account_type" = 'private' AND ("user_profiles"."private_use_confirmed_at" IS NOT NULL OR "user_profiles"."status" = 'deleted')) OR ("user_profiles"."account_type" = 'business' AND (("user_profiles"."org_number" IS NOT NULL AND "user_profiles"."business_name" IS NOT NULL AND "user_profiles"."business_verified_at" IS NOT NULL) OR "user_profiles"."status" = 'deleted')));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_org_number_chk" CHECK ("user_profiles"."org_number" ~ '^[0-9]{9}$');--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_business_name_len" CHECK (char_length("user_profiles"."business_name") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_types_chk" CHECK ("categories"."allowed_listing_types" <@ ARRAY['rent_out','wanted','give_away','service_offer','service_wanted']);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "service_has_no_item_terms" CHECK ("listings"."type" NOT IN ('service_offer','service_wanted') OR ("listings"."declared_value_ore" IS NULL AND "listings"."deposit_ore" IS NULL AND "listings"."item_condition" IS NULL AND "listings"."known_defects" IS NULL AND NOT "listings"."handover_pickup" AND NOT "listings"."handover_owner_delivery" AND NOT "listings"."handover_meet"));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "rent_out_price_unit_chk" CHECK ("listings"."type" <> 'rent_out' OR "listings"."price_unit" IS NULL OR "listings"."price_unit" IN ('hour','day','weekend','week'));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "service_price_unit_chk" CHECK ("listings"."type" NOT IN ('service_offer','service_wanted') OR "listings"."price_unit" IS NULL OR "listings"."price_unit" IN ('hour','sqm','job'));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "service_paid_has_unit" CHECK ("listings"."type" NOT IN ('service_offer','service_wanted') OR "listings"."status" = 'draft' OR coalesce("listings"."price_ore", 0) = 0 OR "listings"."price_unit" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_type_chk" CHECK ("listings"."type" IN ('rent_out','wanted','give_away','service_offer','service_wanted'));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_unit_chk" CHECK ("listings"."price_unit" IN ('hour','day','weekend','week','sqm','job'));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "published_offer_has_handover" CHECK ("listings"."type" IN ('wanted','service_offer','service_wanted') OR "listings"."status" = 'draft' OR "listings"."handover_pickup" OR "listings"."handover_owner_delivery" OR "listings"."handover_meet");