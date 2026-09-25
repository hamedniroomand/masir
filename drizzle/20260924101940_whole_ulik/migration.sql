CREATE TABLE "link_imports" (
	"id" uuid PRIMARY KEY,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid,
	"file_hash" bytea NOT NULL,
	"row_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "import_row" integer;--> statement-breakpoint
CREATE INDEX "link_imports_workspace_created_idx" ON "link_imports" ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "links_import_id_import_row_unique_idx" ON "links" ("import_id","import_row");--> statement-breakpoint
ALTER TABLE "link_imports" ADD CONSTRAINT "link_imports_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_imports" ADD CONSTRAINT "link_imports_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_import_id_link_imports_id_fkey" FOREIGN KEY ("import_id") REFERENCES "link_imports"("id") ON DELETE SET NULL;