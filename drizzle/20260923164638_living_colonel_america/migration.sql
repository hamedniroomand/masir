CREATE TABLE "job_runs" (
	"job" text PRIMARY KEY,
	"last_started_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"next_due_at" timestamp with time zone
);
