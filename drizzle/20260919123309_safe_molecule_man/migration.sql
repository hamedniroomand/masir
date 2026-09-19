ALTER TYPE "member_role" ADD VALUE 'viewer';--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD COLUMN "role" "member_role";