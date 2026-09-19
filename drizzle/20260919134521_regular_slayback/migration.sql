CREATE TABLE "link_aliases" (
	"workspace_id" uuid,
	"slug" text,
	"link_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_aliases_pkey" PRIMARY KEY("workspace_id","slug"),
	CONSTRAINT "link_aliases_slug_format_check" CHECK ("slug" ~ '^[a-z0-9_-]{1,64}$')
);
--> statement-breakpoint
CREATE INDEX "link_aliases_link_id_idx" ON "link_aliases" ("link_id");--> statement-breakpoint
ALTER TABLE "link_aliases" ADD CONSTRAINT "link_aliases_workspace_id_workspaces_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "link_aliases" ADD CONSTRAINT "link_aliases_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE;