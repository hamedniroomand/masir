ALTER TABLE "click_events" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "click_events" ADD COLUMN "attribution_version" smallint;--> statement-breakpoint
ALTER TABLE "click_events" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "click_events" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "click_events" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "click_events" ADD COLUMN "utm_content" text;--> statement-breakpoint
CREATE INDEX "click_events_campaign_created_idx" ON "click_events" ("campaign_id","created_at") WHERE campaign_id is not null;