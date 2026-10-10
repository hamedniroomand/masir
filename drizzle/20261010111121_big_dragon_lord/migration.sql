DO $$
DECLARE live integer;
BEGIN
  SELECT count(*) INTO live FROM "workspaces" WHERE "deleted_at" IS NULL;
  IF live > 1 THEN
    RAISE EXCEPTION 'Masir 2.0 serves one workspace. This database has % live workspaces. Read the 2.0 upgrade notes.', live;
  END IF;
END $$;--> statement-breakpoint
DELETE FROM "click_events" WHERE "workspace_id" IN (SELECT "id" FROM "workspaces" WHERE "deleted_at" IS NOT NULL);--> statement-breakpoint
DELETE FROM "link_daily_stats" WHERE "link_id" IN (SELECT "links"."id" FROM "links" INNER JOIN "workspaces" ON "workspaces"."id" = "links"."workspace_id" WHERE "workspaces"."deleted_at" IS NOT NULL);--> statement-breakpoint
DELETE FROM "workspaces" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "auth_identities" WHERE "provider" IN ('google', 'microsoft');--> statement-breakpoint
DELETE FROM "user_tokens" WHERE "purpose" = 'email_verify';--> statement-breakpoint
DROP INDEX IF EXISTS "workspaces_expires_at_idx";--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN "plan", DROP COLUMN "trial_started_at", DROP COLUMN "trial_ends_at", DROP COLUMN "subscription_status", DROP COLUMN "expires_at", DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email_verified_at", DROP COLUMN "avatar_url";--> statement-breakpoint
DROP TYPE "workspace_plan";--> statement-breakpoint
ALTER TABLE "auth_identities" DROP CONSTRAINT "auth_identities_password_hash_check";--> statement-breakpoint
ALTER TYPE "auth_provider" RENAME TO "auth_provider_old";--> statement-breakpoint
CREATE TYPE "auth_provider" AS ENUM('password');--> statement-breakpoint
ALTER TABLE "auth_identities" ALTER COLUMN "provider" TYPE "auth_provider" USING "provider"::text::"auth_provider";--> statement-breakpoint
DROP TYPE "auth_provider_old";--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_password_hash_check" CHECK (("provider" = 'password') = ("password_hash" is not null));--> statement-breakpoint
ALTER TYPE "token_purpose" RENAME TO "token_purpose_old";--> statement-breakpoint
CREATE TYPE "token_purpose" AS ENUM('password_reset');--> statement-breakpoint
ALTER TABLE "user_tokens" ALTER COLUMN "purpose" TYPE "token_purpose" USING "purpose"::text::"token_purpose";--> statement-breakpoint
DROP TYPE "token_purpose_old";
