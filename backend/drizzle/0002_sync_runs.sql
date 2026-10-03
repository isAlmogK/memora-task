CREATE TYPE "public"."sync_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "progress_source" NOT NULL,
	"status" "sync_status" DEFAULT 'queued' NOT NULL,
	"events_ingested" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_run_one_active_per_user" ON "sync_run" USING btree ("user_id") WHERE "sync_run"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "sync_run_queue_idx" ON "sync_run" USING btree ("created_at") WHERE "sync_run"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "sync_run_user_recent_idx" ON "sync_run" USING btree ("user_id","created_at" DESC NULLS FIRST);