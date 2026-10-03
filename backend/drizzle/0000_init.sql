CREATE TYPE "public"."api_key_scope" AS ENUM('user', 'device');--> statement-breakpoint
CREATE TYPE "public"."progress_source" AS ENUM('manual', 'device', 'kindle_sim');--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" "bytea" NOT NULL,
	"scope" "api_key_scope" NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ol_work_key" text NOT NULL,
	"title" text NOT NULL,
	"authors" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_id" integer,
	"page_count" integer,
	"first_published_year" integer,
	"genre" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_ol_work_key_unique" UNIQUE("ol_work_key"),
	CONSTRAINT "book_page_count_positive" CHECK ("book"."page_count" > 0),
	CONSTRAINT "book_ol_work_key_format" CHECK ("book"."ol_work_key" ~ '^OL[0-9]+W$')
);
--> statement-breakpoint
CREATE TABLE "reading_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reading_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"user_book_id" uuid NOT NULL,
	"source" "progress_source" NOT NULL,
	"external_id" text,
	"percent" numeric(5, 2) NOT NULL,
	"page" integer,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_event_percent_range" CHECK ("reading_event"."percent" between 0 and 100),
	CONSTRAINT "reading_event_page_nonnegative" CHECK ("reading_event"."page" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_count" integer,
	"due_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stack_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "stack_name_length" CHECK (char_length("stack"."name") between 1 and 80),
	CONSTRAINT "stack_target_count_range" CHECK ("stack"."target_count" between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "stack_book" (
	"user_id" uuid NOT NULL,
	"stack_id" uuid NOT NULL,
	"user_book_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stack_book_pk" PRIMARY KEY("stack_id","user_book_id")
);
--> statement-breakpoint
CREATE TABLE "user_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	CONSTRAINT "user_book_user_book_unique" UNIQUE("user_id","book_id"),
	CONSTRAINT "user_book_user_id_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_event" ADD CONSTRAINT "reading_event_user_book_fk" FOREIGN KEY ("user_id","user_book_id") REFERENCES "public"."user_book"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack" ADD CONSTRAINT "stack_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_book" ADD CONSTRAINT "stack_book_stack_fk" FOREIGN KEY ("user_id","stack_id") REFERENCES "public"."stack"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_book" ADD CONSTRAINT "stack_book_user_book_fk" FOREIGN KEY ("user_id","user_book_id") REFERENCES "public"."user_book"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_book" ADD CONSTRAINT "user_book_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_book" ADD CONSTRAINT "user_book_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_event_external_id_unique" ON "reading_event" USING btree ("user_id","source","external_id") WHERE "reading_event"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "reading_event_latest_idx" ON "reading_event" USING btree ("user_book_id","occurred_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "stack_user_name_unique" ON "stack" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "stack_book_user_book_idx" ON "stack_book" USING btree ("user_book_id");