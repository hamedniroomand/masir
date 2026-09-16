CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"utm_campaign" text NOT NULL,
	"utm_medium" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "link_tags" (
	"link_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "link_tags_link_id_tag_id_pk" PRIMARY KEY("link_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
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
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "links_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reserved_slugs" (
	"slug" text PRIMARY KEY NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"actor_user_id" text,
	"link_id" text,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tags" ADD CONSTRAINT "link_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_user_id_created_at_idx" ON "campaigns" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_user_id_utm_campaign_unique_idx" ON "campaigns" USING btree ("user_id","utm_campaign");--> statement-breakpoint
CREATE INDEX "click_events_link_id_created_at_idx" ON "click_events" USING btree ("link_id","created_at");--> statement-breakpoint
CREATE INDEX "click_events_link_id_outcome_created_at_idx" ON "click_events" USING btree ("link_id","outcome","created_at");--> statement-breakpoint
CREATE INDEX "link_tags_tag_id_idx" ON "link_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "links_user_id_created_at_idx" ON "links" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "links_campaign_id_idx" ON "links" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "links_slug_unique_idx" ON "links" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "security_events_link_id_created_at_idx" ON "security_events" USING btree ("link_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_id_normalized_name_unique_idx" ON "tags" USING btree ("user_id","normalized_name");--> statement-breakpoint
CREATE INDEX "tags_user_id_created_at_idx" ON "tags" USING btree ("user_id","created_at");