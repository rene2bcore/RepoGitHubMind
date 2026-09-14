CREATE TABLE "repository_embeddings" (
	"repository_id" uuid PRIMARY KEY NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"model" text NOT NULL,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "repository_embeddings" ADD CONSTRAINT "repository_embeddings_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repositories_search_vector_idx" ON "repositories" USING gin ("search_vector");