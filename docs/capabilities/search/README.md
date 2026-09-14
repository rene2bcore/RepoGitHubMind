# Capability: `search`

Reencuentra lo guardado preguntando con tus palabras, en castellano o en inglés, aunque no coincidan con las del repositorio, y acota por categoría, lenguaje, licencia, estrellas, estado y favorito. Busca en tu biblioteca o en todos los repositorios que conoce RepoGitHubMind, y cada resultado dice por qué aparece.

> **Dónde está la verdad.** Las reglas viven en [`docs/specs/search/spec.md`](../../specs/search/spec.md) y este README no las repite: enlaza a cada una y dice dónde está implementada. Si algo de aquí y la spec no concuerdan, manda la spec. Embeddings, modelo y coste, en [`docs/ai-architecture.md`](../../ai-architecture.md) · «Embeddings».

## Route Handlers

En `apps/web/src/app/api/v1/search/route.ts`, envuelto en `handle()`. Contrato en [`docs/api/openapi.json`](../../api/openapi.json).

| Método y ruta        | Entrada                                                                                                                                                                                                                                                                       | Handler    | Devuelve                                                                                                                                                                                                                    | Sesión |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `GET /api/v1/search` | `searchQuerySchema`, `strict`: `q` (2 a 200), `scope` (`library` por defecto, `global`), `category` (slug del catálogo), `language`, `license` (hasta diez, separadas por comas, en OR), `minStars`, `status` y `favorite` (solo `library`), `limit` (1 a 50, 20 por defecto) | `route.ts` | `200 { data: SearchResult[], meta: { scope, mode, total } }`; `401`; `422` por `q` corta, filtro fuera del dominio, parámetro desconocido o repetido, categoría fuera del catálogo o `status`/`favorite` en `global`; `429` | sí     |

Orden en el handler: sesión, validación de la query, rate limit por cuenta (`search:<userId>`, H-07), búsqueda.

## Server Actions

Ninguna. La pantalla `/search` es un componente de servidor que valida la URL con el mismo esquema, cuenta en el mismo rate limit y llama al servicio; «+ Guardar» en un resultado que no está en mi biblioteca llama a `api.saveRepository`.

## Formas de respuesta

`SearchResult` (`searchResultSchema` en `packages/shared/src/schemas.ts`):

| Campo            | Qué                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | El id de **mi** relación con el repositorio, para ir a `/repositories/{id}`; null si no está en mi biblioteca                                                                 |
| `repository`     | El repositorio global con `analysis` y `categories`, igual que en la biblioteca                                                                                               |
| `personal`       | **Mi** estado, favorito, rating y notas; null si no está en mi biblioteca. Nunca los de otra cuenta, en ningún ámbito                                                         |
| `match.fields`   | Campos del documento léxico en los que coincide: `name`, `description`, `topics`, `categories`, `summary`, `purpose`, `useCases`, `tags`. Vacío si entró solo por significado |
| `match.terms`    | Palabras de la consulta que coinciden, sin palabras vacías                                                                                                                    |
| `match.semantic` | Si entró por similitud de coseno por encima del umbral del modelo                                                                                                             |
| `match.reason`   | El «Por qué» en una línea: «Coincide «postgres» en la descripción y los topics, y se parece por significado a lo que buscas»                                                  |

`meta.mode` es `hybrid` con embedding de la consulta y `lexical` sin él (IA apagada, proveedor mal configurado o caído): la búsqueda no falla por la IA. `meta.total` es el número de resultados devueltos; no hay paginación.

## Cómo se busca

1. La consulta se parte en palabras (`lexicalTerms`), sin palabras vacías en castellano ni inglés, y se busca cada una como prefijo y en OR sobre `repositories.search_vector` con la configuración `simple` (`lexicalCandidates`), ordenado por `ts_rank_cd`. Por qué `simple`: el corpus mezcla inglés y castellano, y un stemmer del idioma equivocado produce raíces falsas.
2. Con la IA activa, la consulta se vectoriza con el proveedor de embeddings (una fila de `ai_usage` sin repositorio) y se buscan los repositorios con embedding del mismo modelo por similitud de coseno por encima de `minSimilarity` (`semanticCandidates`).
3. Las dos listas, cada una de hasta 50 candidatos y con los mismos filtros, se fusionan con Reciprocal Rank Fusion, k = 60 (`fuseRankings`), y se recortan a `limit`.
4. Los resultados se cargan con **mi** relación en la condición del join (`loadSearchItems`) y cada uno lleva su explicación (`explainMatch`).

Qué entra en cada documento:

| Documento                             | Campos                                                                                                              | Cuándo se escribe                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `repositories.search_vector` (léxico) | `owner name` (A); descripción, topics, categorías con su ruta (B); resumen, propósito, casos de uso, tags de IA (C) | Al dar de alta el repositorio (`saveRepository`) y al completar su análisis (`saveAnalysis`, en la misma transacción) |
| `repository_embeddings` (semántico)   | Texto de `buildSemanticText`: nombre, descripción, resumen, propósito, casos de uso, categorías, tags y topics      | `GENERATE_EMBEDDING`, encolado al completar el análisis; no llama si el hash del texto y el modelo son los guardados  |

Ninguno de los dos lleva nada de `user_repositories`: una nota no se busca desde ningún ámbito.

## Dónde vive cada cosa

| Pieza                  | Fichero                                                                     | Qué hace                                                                                             |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Texto semántico y hash | `packages/search/src/semantic-text.ts`                                      | `buildSemanticText`, `semanticTextHash`, `embeddingIsCurrent`                                        |
| Documento léxico       | `packages/search/src/document.ts`                                           | `SEARCH_FIELD_SOURCES`, `searchDocument`, `refreshSearchVector`, `TEXT_SEARCH_CONFIG`                |
| Consulta               | `packages/search/src/query.ts`                                              | `lexicalTerms`, `prefixTsQuery`                                                                      |
| Candidatos             | `packages/search/src/candidates.ts`                                         | `lexicalCandidates`, `semanticCandidates`, ámbito y filtros                                          |
| Fusión y explicación   | `packages/search/src/rrf.ts`, `explain.ts`                                  | `fuseRankings` con `RRF_K = 60`, `explainMatch`                                                      |
| Lectura y escritura    | `packages/search/src/store.ts`                                              | `loadSemanticSource`, `saveEmbedding`, `recordEmbeddingUsage`                                        |
| Proveedores            | `packages/ai/src/embeddings.ts`, `registry.ts`, `defaults.ts`               | `OpenRouterEmbeddingProvider`, `FakeEmbeddingProvider`, modelo, dimensión y umbral                   |
| Trabajo                | `apps/worker/src/embed.ts`, `analyze.ts`                                    | `GENERATE_EMBEDDING`; el análisis reescribe `search_vector` y lo encola                              |
| Servicio               | `apps/web/src/modules/search/service.ts`, `modules/repositories/service.ts` | `searchRepositories`, `listSearchFacets`, `loadSearchItems`, `categoryPath`                          |
| Pantalla               | `app/(app)/search/page.tsx`, `components/search-view.tsx`                   | Buscador, ámbito, filtros en la URL, resultados con «Por qué», estados vacío, sin resultados y error |
| Datos                  | `packages/db/src/schema.ts`, migraciones `0003` a `0005`                    | Extensión `vector`, `repository_embeddings`, `search_vector` con GIN, relleno de lo existente        |

## Reglas que no se ven en el contrato

| Regla                                                                                                                                                | Requisito de la spec                                                           | Dónde vive                                                                | Prueba                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una consulta sin palabras en común encuentra el repositorio por significado                                                                          | Búsqueda híbrida · Palabras que no aparecen                                    | `semanticCandidates`, `fuseRankings`                                      | `apps/web/tests/search.test.ts` · ««vectores similares», sin ninguna palabra en común, encuentra pgvector primero...»; `rrf.test.ts`                                                                 |
| Un repositorio sin embedding aparece por coincidencia léxica; sin embedding de la consulta, modo léxico                                              | Búsqueda híbrida · Sin embedding todavía                                       | `refreshSearchVector` en `saveRepository`, `embedQuery`                   | `search.test.ts` · «un repositorio recién guardado, sin embedding todavía, aparece por coincidencia léxica...»                                                                                       |
| `q` de menos de dos caracteres, parámetro desconocido o repetido: `422` sobre ese campo; en la pantalla, un parámetro repetido se dice y no se busca | Búsqueda híbrida · Consulta vacía; Filtros combinables en la URL               | `searchQuerySchema`, `parseQuery`, `repeatedParam` en `search/page.tsx`   | `search.test.ts` · «una consulta de un carácter, un parámetro desconocido o repetido son 422...»; `flujo.e2e.ts` · `/search?...&license=MIT&license=PostgreSQL` y `/library?status=USING&status=NEW` |
| Se vectoriza un texto con los ocho campos y solo si cambió el texto o el modelo                                                                      | Qué se vectoriza · Texto sin cambios                                           | `buildSemanticText`, `embeddingIsCurrent`, `generateEmbeddingJob`         | `semantic-text.test.ts` (3); `apps/worker/tests/embeddings.test.ts` · «con el texto y el modelo sin cambios no se pide otro embedding ni se registra coste...»                                       |
| En `global`, ni la nota, ni el estado, ni el rating de otra cuenta, ni quién lo guardó; una nota ajena no se busca                                   | Ámbitos y privacidad · Buscar en el corpus global · Una nota ajena no se busca | `loadSearchItems` (cuenta en el join), documentos sin `user_repositories` | `search.test.ts` · «en global, la nota, el estado y el rating de Ada no salen ni se buscan para Grace...»; mutación `busqueda-global-privada`                                                        |
| En `library`, solo lo de la cuenta de la sesión                                                                                                      | Ámbitos y privacidad · Buscar en mi biblioteca                                 | `conditions` en `candidates.ts`                                           | la misma prueba; mutación `busqueda-biblioteca-privada`                                                                                                                                              |
| Licencias en OR, estrellas mínimas, lenguaje, categoría por rama, estado y favorito, combinados; lo personal en `global` es 422                      | Filtros combinables en la URL · Combinación                                    | `searchQuerySchema`, `conditions`, `categoryPath`                         | `search.test.ts` · «los filtros se combinan con la consulta...»                                                                                                                                      |
| Los filtros viajan en la URL y la búsqueda se reabre igual                                                                                           | Filtros combinables en la URL · Compartir                                      | `search/page.tsx`, `SearchView.navigate`                                  | `flujo.e2e.ts` · `/search?q=...&license=MIT`                                                                                                                                                         |
| Cada resultado en una línea con nombre, categoría, estrellas, licencia, actividad y «Por qué»; el buscador primero con su placeholder                | Resultado legible · Lista de resultados                                        | `SearchResultCard`, `explainMatch`, `activityLabel`                       | `explain.test.ts` (2); `flujo.e2e.ts` · buscar «vectores en postgres» desde la pantalla                                                                                                              |
| Si el texto cambia mientras se vectoriza, el trabajo lo repite; si no deja de cambiar tras tres vectorizaciones, vuelve a la cola                    | Qué se vectoriza                                                               | `generateEmbeddingJob`                                                    | `embeddings.test.ts` (worker) · «si el texto cambia mientras se vectoriza...; si no deja de cambiar, vuelve a la cola»                                                                               |
| Proveedor de embeddings: clave solo en la cabecera, dimensión 1536, `429`/`5xx` reintentables                                                        | Búsqueda híbrida (PA-3)                                                        | `OpenRouterEmbeddingProvider`, `postOpenRouter`                           | `packages/ai/tests/embeddings.test.ts` (4); `registry.test.ts`                                                                                                                                       |
| Rate limit por cuenta en búsqueda, API y pantalla                                                                                                    | PRD §7                                                                         | `checkRateLimit(\`search:${userId}\`)`                                    | sin prueba propia: misma función que auth, probada allí                                                                                                                                              |

## Ejecutar y probar

```bash
docker compose -f docker/docker-compose.yml up -d postgres
pnpm db:migrate                             # 0003 habilita vector; 0005 rellena search_vector y encola embeddings
pnpm test -- packages/search                # texto semántico, RRF, consulta, explicación
pnpm test -- packages/ai/tests/embeddings   # proveedor de embeddings con fetch grabado
pnpm test -- apps/worker/tests/embeddings   # GENERATE_EMBEDDING contra la base de pruebas
pnpm test -- apps/web/tests/search          # la ruta con dos cuentas, filtros y modo léxico
pnpm test:e2e                               # buscar desde la pantalla con el worker real
node scripts/mutaciones.mjs busqueda-global-privada busqueda-biblioteca-privada
```

En desarrollo sin clave, `AI_FAKE=1`: el proveedor de embeddings falso usa trigramas de caracteres, así que «vectores» encuentra «vector» pero no sabe de sinónimos. Con clave de OpenRouter, `AI_FAKE=0` y, si se quiere otro modelo, `AI_MODEL_EMBEDDING`, revisando el umbral de `defaults.ts`.
