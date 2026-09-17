CREATE TABLE "auth_identities" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"utm_campaign" text NOT NULL,
	"utm_medium" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" text PRIMARY KEY,
	"link_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"referrer_host" text,
	"country" text,
	"device_category" text NOT NULL,
	"browser_category" text NOT NULL,
	"outcome" text,
	"is_bot" boolean,
	"bot_category" text,
	"visitor_hash" text
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_tags" (
	"link_id" text,
	"tag_id" text,
	CONSTRAINT "link_tags_pkey" PRIMARY KEY("link_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"title" text,
	"destination_url" text NOT NULL,
	"destination_host" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"password_hash" text,
	"starts_at" timestamp with time zone,
	"expiration_destination" text,
	"maximum_visits" integer,
	"successful_visit_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"campaign_id" text,
	"utm_source" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_outbox" (
	"id" text PRIMARY KEY,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserved_slugs" (
	"slug" text PRIMARY KEY,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" text PRIMARY KEY,
	"created_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"actor_user_id" text,
	"link_id" text,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"email_verified_at" timestamp with time zone,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_account_unique_idx" ON "auth_identities" ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities" ("user_id");--> statement-breakpoint
CREATE INDEX "campaigns_user_id_created_at_idx" ON "campaigns" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_user_id_utm_campaign_unique_idx" ON "campaigns" ("user_id","utm_campaign");--> statement-breakpoint
CREATE INDEX "click_events_link_id_created_at_idx" ON "click_events" ("link_id","created_at");--> statement-breakpoint
CREATE INDEX "click_events_link_id_outcome_created_at_idx" ON "click_events" ("link_id","outcome","created_at");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "link_tags_tag_id_idx" ON "link_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "links_user_id_created_at_idx" ON "links" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "links_campaign_id_idx" ON "links" ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "links_slug_unique_idx" ON "links" ("slug");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "security_events_link_id_created_at_idx" ON "security_events" ("link_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_id_normalized_name_unique_idx" ON "tags" ("user_id","normalized_name");--> statement-breakpoint
CREATE INDEX "tags_user_id_created_at_idx" ON "tags" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_tag_id_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_campaign_id_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;