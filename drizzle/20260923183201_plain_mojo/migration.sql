CREATE TABLE "service_signals" (
	"key" text PRIMARY KEY,
	"state" text NOT NULL,
	"detail" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
