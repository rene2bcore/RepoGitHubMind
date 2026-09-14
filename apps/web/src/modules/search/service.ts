import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { AIProviderCallError, getEmbeddingProvider } from '@rgm/ai'
import {
  categories,
  getDb,
  repositories,
  repositoryCategories,
  userRepositories,
  type Database,
} from '@rgm/db'
import {
  explainMatch,
  fuseRankings,
  lexicalCandidates,
  lexicalTerms,
  recordEmbeddingUsage,
  semanticCandidates,
  type SearchScope,
} from '@rgm/search'
import {
  readEnv,
  type Category,
  type SearchMeta,
  type SearchQuery,
  type SearchResult,
  type SearchScopeName,
} from '@rgm/shared'
import { categoryPath, loadSearchItems } from '@/modules/repositories/service'

/**
 * specs/search · «Búsqueda híbrida», «Ámbitos y privacidad», «Filtros
 * combinables» y «Resultado legible».
 *
 * La consulta viaja por dos caminos con los mismos filtros: la lista léxica
 * sobre `search_vector` y la semántica por coseno sobre `repository_embeddings`
 * con el embedding de la consulta. Se fusionan con RRF y cada resultado lleva
 * su «Por qué». La identidad sale de la sesión: en `library` se busca solo en
 * la relación de `userId`, y en `global` en todo el corpus sin tocar lo
 * personal de nadie; `personal` es siempre la relación de `userId` o null.
 *
 * Sin embedding de la consulta (IA apagada, proveedor mal configurado o
 * caído) la búsqueda no falla: sigue solo con la parte léxica y lo dice en
 * `meta.mode`.
 */
export async function searchRepositories(
  userId: string,
  query: SearchQuery,
): Promise<{ items: SearchResult[]; meta: SearchMeta }> {
  const db = getDb()
  const scope: SearchScope = {
    scope: query.scope,
    userId,
    categoryPath: query.category ? await categoryPath(db, query.category) : undefined,
    language: query.language,
    licenses: query.license,
    minStars: query.minStars,
    status: query.status,
    favorite: query.favorite,
  }
  const terms = lexicalTerms(query.q)
  const embedding = await embedQuery(db, query.q)
  const [lexical, semantic] = await Promise.all([
    lexicalCandidates(db, scope, terms),
    embedding ? semanticCandidates(db, scope, embedding) : Promise.resolve([]),
  ])

  const fused = fuseRankings([lexical.map((c) => c.id), semantic.map((c) => c.id)]).slice(
    0,
    query.limit,
  )
  const lexicalById = new Map(lexical.map((c) => [c.id, c]))
  const semanticIds = new Set(semantic.map((c) => c.id))
  const items = await loadSearchItems(
    userId,
    fused.map((f) => f.id),
  )

  return {
    items: items.map((item) => {
      const match = lexicalById.get(item.repository.id)
      const fields = match?.fields ?? []
      const matchedTerms = match?.terms ?? []
      const isSemantic = semanticIds.has(item.repository.id)
      return {
        ...item,
        match: {
          fields,
          terms: matchedTerms,
          semantic: isSemantic,
          reason: explainMatch({
            terms: matchedTerms,
            fields,
            semantic: isSemantic,
            categories: item.repository.categories.map((c) => c.name),
            about: item.repository.analysis.summary ?? item.repository.description,
          }),
        },
      }
    }),
    meta: { scope: query.scope, mode: embedding ? 'hybrid' : 'lexical', total: items.length },
  }
}

/**
 * El embedding de la consulta, con el modelo y el umbral del proveedor, o
 * null si no se puede tener. Cada llamada deja su fila en `ai_usage` sin
 * repositorio, también si falla; la consulta no se guarda en ningún sitio.
 */
async function embedQuery(
  db: Database,
  q: string,
): Promise<{ vector: number[]; model: string; minSimilarity: number } | null> {
  if (!readEnv().AI_ANALYSIS_ENABLED) return null
  let provider
  try {
    provider = getEmbeddingProvider()
  } catch (error) {
    console.error(`búsqueda: sin proveedor de embeddings, solo léxica. ${messageOf(error)}`)
    return null
  }
  try {
    const outcome = await provider.embed([q])
    await recordEmbeddingUsage(db, null, provider, [outcome.call])
    return {
      vector: outcome.vectors[0]!,
      model: provider.model,
      minSimilarity: provider.minSimilarity,
    }
  } catch (error) {
    if (!(error instanceof AIProviderCallError)) throw error
    await recordEmbeddingUsage(db, null, provider, error.calls)
    console.error(`búsqueda: el embedding de la consulta falló, solo léxica. ${error.message}`)
    return null
  }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

export type SearchFacets = { categories: Category[]; languages: string[]; licenses: string[] }

/**
 * Los valores que ofrecen los filtros de la pantalla, sacados del ámbito: en
 * `library`, lo que hay en mi biblioteca; en `global`, lo que hay en el
 * corpus. Son datos de repositorios, nunca de quién los guardó. Las
 * categorías llevan sus antecesoras para poder filtrar por rama.
 */
export async function listSearchFacets(
  userId: string,
  scope: SearchScopeName,
): Promise<SearchFacets> {
  const db = getDb()
  const inScope =
    scope === 'library'
      ? sql`exists (select 1 from ${userRepositories} where ${userRepositories.repositoryId} = ${repositories.id} and ${userRepositories.userId} = ${userId})`
      : sql`true`
  const [used, languages, licenses] = await Promise.all([
    db
      .selectDistinct({ path: categories.path })
      .from(repositoryCategories)
      .innerJoin(categories, eq(categories.id, repositoryCategories.categoryId))
      .innerJoin(repositories, eq(repositories.id, repositoryCategories.repositoryId))
      .where(inScope),
    db
      .selectDistinct({ value: repositories.primaryLanguage })
      .from(repositories)
      .where(and(isNotNull(repositories.primaryLanguage), inScope))
      .orderBy(asc(repositories.primaryLanguage)),
    db
      .selectDistinct({ value: repositories.license })
      .from(repositories)
      .where(and(isNotNull(repositories.license), inScope))
      .orderBy(asc(repositories.license)),
  ])
  const paths = new Set(
    used.flatMap(({ path }) =>
      path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/')),
    ),
  )
  return {
    categories: paths.size
      ? await db
          .select({ slug: categories.slug, name: categories.name, path: categories.path })
          .from(categories)
          .where(inArray(categories.path, [...paths]))
          .orderBy(categories.path)
      : [],
    languages: languages.map((l) => l.value!),
    licenses: licenses.map((l) => l.value!),
  }
}
