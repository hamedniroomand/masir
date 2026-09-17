CREATE TABLE "workspace_members" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"plan" text DEFAULT 'TRIAL' NOT NULL,
	"trial_started_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"subscription_status" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "links" DROP CONSTRAINT "links_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "tags_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "links" DROP CONSTRAINT "links_slug_key";--> statement-breakpoint
DROP INDEX "campaigns_user_id_created_at_idx";--> statement-breakpoint
DROP INDEX "campaigns_user_id_utm_campaign_unique_idx";--> statement-breakpoint
DROP INDEX "links_user_id_created_at_idx";--> statement-breakpoint
DROP INDEX "links_slug_unique_idx";--> statement-breakpoint
DROP INDEX "tags_user_id_normalized_name_unique_idx";--> statement-breakpoint
DROP INDEX "tags_user_id_created_at_idx";--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "workspace_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "click_events" ADD COLUMN "workspace_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "workspace_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "reserved_slugs" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "workspace_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "links" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "reserved_slugs" DROP CONSTRAINT "reserved_slugs_pkey";--> statement-breakpoint
ALTER TABLE "reserved_slugs" ADD PRIMARY KEY ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "campaigns_workspace_id_created_at_idx" ON "campaigns" ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_workspace_utm_campaign_unique_idx" ON "campaigns" ("workspace_id","utm_campaign");--> statement-breakpoint
CREATE INDEX "click_events_workspace_id_created_at_idx" ON "click_events" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "links_workspace_id_created_at_idx" ON "links" ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "links_workspace_slug_unique_idx" ON "links" ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_normalized_name_unique_idx" ON "tags" ("workspace_id","normalized_name");--> statement-breakpoint
CREATE INDEX "tags_workspace_id_created_at_idx" ON "tags" ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_unique_idx" ON "workspace_members" ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_single_owner_idx" ON "workspace_members" ("workspace_id") WHERE role = 'OWNER';--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_unique_idx" ON "workspaces" ("slug");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reserved_slugs" ADD CONSTRAINT "reserved_slugs_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;