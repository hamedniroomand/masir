CREATE TABLE "workspace_link_prefixes" (
	"workspace_id" uuid,
	"prefix" text,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "workspace_link_prefixes_pkey" PRIMARY KEY("workspace_id","prefix")
);
--> statement-breakpoint
ALTER TABLE "workspace_link_prefixes" ADD CONSTRAINT "workspace_link_prefixes_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;