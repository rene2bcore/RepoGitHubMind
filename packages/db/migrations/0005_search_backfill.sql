-- Custom SQL migration file, put your code below! --
-- H5 · RGM-6. Migración personalizada: datos, no esquema, y Drizzle no la
-- genera. Deja buscables los repositorios que ya existían antes de H5.
--
-- 1. `search_vector` de cada repositorio. Es una copia congelada, a fecha de
--    esta migración, de `searchDocument()` en packages/search/src/document.ts,
--    que es la definición viva: a partir de aquí lo escribe
--    `refreshSearchVector` al guardar y al completar un análisis.
UPDATE "repositories" SET "search_vector" =
  setweight(to_tsvector('simple', "repositories"."owner" || ' ' || "repositories"."name"), 'A')
  || setweight(to_tsvector('simple', coalesce("repositories"."description", '')), 'B')
  || setweight(to_tsvector('simple', array_to_string("repositories"."topics", ' ')), 'B')
  || setweight(to_tsvector('simple', coalesce((
    select string_agg("categories"."name" || ' ' || replace("categories"."path", '/', ' '), ' ')
    from "repository_categories"
    inner join "categories" on "categories"."id" = "repository_categories"."category_id"
    where "repository_categories"."repository_id" = "repositories"."id"
  ), '')), 'B')
  || setweight(to_tsvector('simple', coalesce((select "repository_analyses"."summary" from "repository_analyses" where "repository_analyses"."repository_id" = "repositories"."id"), '')), 'C')
  || setweight(to_tsvector('simple', coalesce((select "repository_analyses"."purpose" from "repository_analyses" where "repository_analyses"."repository_id" = "repositories"."id"), '')), 'C')
  || setweight(to_tsvector('simple', coalesce((select array_to_string("repository_analyses"."main_use_cases", ' ') from "repository_analyses" where "repository_analyses"."repository_id" = "repositories"."id"), '')), 'C')
  || setweight(to_tsvector('simple', coalesce((
    select string_agg("tags"."slug", ' ')
    from "repository_tags"
    inner join "tags" on "tags"."id" = "repository_tags"."tag_id"
    where "repository_tags"."repository_id" = "repositories"."id" and "tags"."kind" = 'AI'
  ), '')), 'C');
--> statement-breakpoint
-- 2. Un `GENERATE_EMBEDDING` por cada análisis ya completado, que es cuando se
--    encola en adelante. El índice único parcial de la cola lo hace
--    idempotente; con la IA apagada el worker los completa sin llamar a nadie.
INSERT INTO "background_jobs" ("type", "repository_id")
SELECT 'GENERATE_EMBEDDING', "repository_id" FROM "repository_analyses" WHERE "status" = 'COMPLETED'
ON CONFLICT DO NOTHING;
