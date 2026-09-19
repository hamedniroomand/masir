ALTER TABLE "workspaces" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "workspaces_expires_at_idx" ON "workspaces" ("expires_at") WHERE expires_at is not null;