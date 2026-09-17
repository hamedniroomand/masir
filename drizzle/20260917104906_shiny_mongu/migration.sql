ALTER TABLE "security_events" ADD COLUMN "workspace_id" text;--> statement-breakpoint
CREATE INDEX "security_events_workspace_id_created_at_idx" ON "security_events" ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;