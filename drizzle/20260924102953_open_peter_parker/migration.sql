ALTER TABLE "links" ADD COLUMN "responsible_user_id" uuid;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_responsible_user_id_users_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL;