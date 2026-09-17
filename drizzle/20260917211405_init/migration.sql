CREATE TYPE "auth_provider" AS ENUM('password', 'google', 'microsoft');--> statement-breakpoint
CREATE TYPE "member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "token_purpose" AS ENUM('email_verify', 'password_reset');--> statement-breakpoint
CREATE TYPE "workspace_plan" AS ENUM('trial', 'active', 'trial_expired');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid,
	"actor_id" uuid,
	"link_id" uuid,
	"type" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_password_hash_check" CHECK (("provider" = 'password') = ("password_hash" is not null))
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"workspace_id" uuid NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"utm_campaign" text NOT NULL,
	"utm_medium" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "click_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"visitor_hash" bigint,
	"workspace_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"referrer_host" integer,
	"outcome" smallint NOT NULL,
	"device" smallint NOT NULL,
	"browser" smallint NOT NULL,
	"bot_category" smallint,
	"country" char(2),
	"is_bot" boolean NOT NULL,
	CONSTRAINT "click_events_pkey" PRIMARY KEY("created_at","id")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hosts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"host" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "link_daily_stats" (
	"link_id" uuid,
	"day" date,
	"human_clicks" integer DEFAULT 0 NOT NULL,
	"bot_requests" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "link_daily_stats_pkey" PRIMARY KEY("link_id","day")
);
--> statement-breakpoint
CREATE TABLE "link_tags" (
	"workspace_id" uuid NOT NULL,
	"link_id" uuid,
	"tag_id" uuid,
	CONSTRAINT "link_tags_pkey" PRIMARY KEY("link_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid,
	"created_by" uuid,
	"slug" text NOT NULL,
	"title" text,
	"destination_url" text NOT NULL,
	"destination_host" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"expiration_destination" text,
	"password_hash" text,
	"maximum_visits" bigint,
	"click_count" bigint DEFAULT 0 NOT NULL,
	"utm_source" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_slug_format_check" CHECK ("slug" ~ '^[a-z0-9_-]{1,64}$'),
	CONSTRAINT "links_maximum_visits_check" CHECK ("maximum_visits" > 0),
	CONSTRAINT "links_click_count_check" CHECK ("click_count" >= 0),
	CONSTRAINT "links_schedule_check" CHECK ("starts_at" is null or "expires_at" is null or "starts_at" < "expires_at"),
	CONSTRAINT "links_campaign_utm_check" CHECK ("campaign_id" is null or "utm_campaign" is null)
);
--> statement-breakpoint
CREATE TABLE "mail_outbox" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" bytea NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"email" text NOT NULL UNIQUE,
	"email_verified_at" timestamp with time zone,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_lower_check" CHECK ("email" = lower("email"))
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" bytea NOT NULL UNIQUE,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_email_lower_check" CHECK ("email" = lower("email"))
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid,
	"user_id" uuid,
	"role" "member_role" NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_pkey" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"logo_url" text,
	"plan" "workspace_plan" DEFAULT 'active'::"workspace_plan" NOT NULL,
	"trial_started_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"subscription_status" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_format_check" CHECK ("slug" ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')
);
--> statement-breakpoint
CREATE INDEX "audit_events_workspace_created_idx" ON "audit_events" ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_link_created_idx" ON "audit_events" ("link_id","created_at" DESC NULLS LAST) WHERE link_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_account_unique_idx" ON "auth_identities" ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_workspace_utm_campaign_unique_idx" ON "campaigns" ("workspace_id","utm_campaign");--> statement-breakpoint
CREATE INDEX "campaigns_workspace_created_idx" ON "campaigns" ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "click_events_link_created_idx" ON "click_events" ("link_id","created_at");--> statement-breakpoint
CREATE INDEX "click_events_workspace_created_idx" ON "click_events" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "link_tags_tag_id_idx" ON "link_tags" ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "links_workspace_slug_unique_idx" ON "links" ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "links_workspace_created_idx" ON "links" ("workspace_id","created_at" DESC NULLS LAST) WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "links_workspace_clicks_idx" ON "links" ("workspace_id","click_count" DESC NULLS LAST) WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "links_campaign_idx" ON "links" ("campaign_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_normalized_name_unique_idx" ON "tags" ("workspace_id","normalized_name");--> statement-breakpoint
CREATE INDEX "user_tokens_user_purpose_idx" ON "user_tokens" ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "user_tokens_expires_at_idx" ON "user_tokens" ("expires_at");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_id_idx" ON "workspace_invitations" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_open_idx" ON "workspace_invitations" ("workspace_id","email") WHERE accepted_at is null and revoked_at is null;--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_one_owner_idx" ON "workspace_members" ("workspace_id") WHERE role = 'owner';--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_referrer_host_hosts_id_fkey" FOREIGN KEY ("referrer_host") REFERENCES "hosts"("id");--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_tag_id_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;