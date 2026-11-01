ALTER TABLE "media_objects" DROP CONSTRAINT "media_scope_chk";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "avatar_media_id" uuid;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_avatar_media_id_media_objects_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_scope_chk" CHECK ("media_objects"."scope" IN ('listing','condition','dispute','avatar'));