ALTER TABLE "links" ADD COLUMN "cap_alert_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "expiry_alert_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "links_expiry_alert_idx" ON "links" ("expires_at") WHERE expiry_alert_sent_at is null and deleted_at is null and expires_at is not null;