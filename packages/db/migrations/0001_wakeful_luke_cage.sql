CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"repository_id" uuid,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_repository_id" bigint NOT NULL,
	"full_name" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"homepage" text,
	"primary_language" text,
	"license" text,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"fork" boolean DEFAULT false NOT NULL,
	"default_branch" text,
	"readme" text,
	"latest_release" text,
	"github_created_at" timestamp with time zone,
	"github_updated_at" timestamp with time zone,
	"github_pushed_at" timestamp with time zone,
	"latest_release_at" timestamp with time zone,
	"metadata_refreshed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"summary" text,
	"purpose" text,
	"main_use_cases" text[] DEFAULT '{}'::text[] NOT NULL,
	"installation_summary" text,
	"deployment_type" text[] DEFAULT '{}'::text[] NOT NULL,
	"frameworks" text[] DEFAULT '{}'::text[] NOT NULL,
	"maturity" text,
	"advantages" text[] DEFAULT '{}'::text[] NOT NULL,
	"limitations" text[] DEFAULT '{}'::text[] NOT NULL,
	"target_users" text[] DEFAULT '{}'::text[] NOT NULL,
	"activity_assessment" text,
	"abandonment_risk" text,
	"ai_confidence" real,
	"provider" text,
	"model" text,
	"last_error" text,
	"ai_analyzed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repository_analyses_repository_id_unique" UNIQUE("repository_id")
);
--> statement-breakpoint
CREATE TABLE "user_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"rating" smallint,
	"notes" text,
	"source" text,
	"source_text" text,
	"custom_title" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_repositories" ADD CONSTRAINT "user_repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_repositories" ADD CONSTRAINT "user_repositories_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "background_jobs_status_run_after_idx" ON "background_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_active_unique" ON "background_jobs" USING btree ("type","repository_id") WHERE "background_jobs"."status" in ('QUEUED', 'PROCESSING');--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_github_id_unique" ON "repositories" USING btree ("github_repository_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_full_name_unique" ON "repositories" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "repositories_pushed_at_idx" ON "repositories" USING btree ("github_pushed_at");--> statement-breakpoint
CREATE INDEX "repositories_stars_idx" ON "repositories" USING btree ("stars");--> statement-breakpoint
CREATE INDEX "repositories_language_idx" ON "repositories" USING btree ("primary_language");--> statement-breakpoint
CREATE INDEX "repositories_license_idx" ON "repositories" USING btree ("license");--> statement-breakpoint
CREATE UNIQUE INDEX "user_repositories_user_repo_unique" ON "user_repositories" USING btree ("user_id","repository_id");--> statement-breakpoint
CREATE INDEX "user_repositories_user_status_idx" ON "user_repositories" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_repositories_user_favorite_idx" ON "user_repositories" USING btree ("user_id","favorite");--> statement-breakpoint
CREATE INDEX "user_repositories_user_saved_idx" ON "user_repositories" USING btree ("user_id","saved_at");