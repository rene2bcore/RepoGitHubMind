import { and, asc, cosineDistance, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm'
import {
  categories,
  repositories,
  repositoryCategories,
  repositoryEmbeddings,
  userRepositories,
  type Database,
} from '@rgm/db'
import { SEARCH_FIELDS, type PersonalStatus, type SearchField } from '@rgm/shared'
import { SEARCH_FIELD_SOURCES, toTsQuery, toTsVector } from './document'
import { prefixTsQuery } from './query'

/**
 * Sobre qué repositorios se busca y con qué filtros, ya validados.
 *
 * - `library`: solo los que están en la relación de `userId`, que sale de la
 *   sesión. `status` y `favorite` filtran esa relación.
 * - `global`: todos los repositorios conocidos. No se toca
 *   `user_repositories`, así que ni se filtra ni se ordena por lo que haya
 *   hecho ninguna cuenta.
 */
export type SearchScope = {
  scope: 'library' | 'global'
  userId: string
  /** Ruta de la categoría: filtra por la rama entera. */
  categoryPath?: string
  language?: string
  licenses?: string[]
  minStars?: number
  status?: PersonalStatus
  favorite?: boolean
}

/** Cuántos candidatos aporta cada lista a la fusión. El resultado final se recorta después. */
export const CANDIDATES_PER_LIST = 50

export type LexicalCandidate = { id: string; fields: SearchField[]; terms: string[] }
export type SemanticCandidate = { id: string; similarity: number }

/** Las condiciones del ámbito y de los filtros, iguales para las dos listas. */
function conditions(scope: SearchScope): SQL[] {
  const list: SQL[] = []
  if (scope.scope === 'library') {
    const mine = [
      eq(userRepositories.repositoryId, repositories.id),
      eq(userRepositories.userId, scope.userId),
    ]
    if (scope.status) mine.push(eq(userRepositories.status, scope.status))
    if (scope.favorite !== undefined) mine.push(eq(userRepositories.favorite, scope.favorite))
    list.push(sql`exists (select 1 from ${userRepositories} where ${and(...mine)})`)
  }
  if (scope.language)
    list.push(sql`lower(${repositories.primaryLanguage}) = ${scope.language.toLowerCase()}`)
  if (scope.licenses?.length)
    list.push(
      inArray(
        sql`lower(${repositories.license})`,
        scope.licenses.map((l) => l.toLowerCase()),
      ),
    )
  if (scope.minStars !== undefined) list.push(gte(repositories.stars, scope.minStars))
  if (scope.categoryPath)
    list.push(sql`exists (
      select 1 from ${repositoryCategories}
      inner join ${categories} on ${categories.id} = ${repositoryCategories.categoryId}
      where ${repositoryCategories.repositoryId} = ${repositories.id}
        and (${categories.path} = ${scope.categoryPath} or ${categories.path} like ${`${scope.categoryPath}/%`})
    )`)
  return list
}

/**
 * La lista léxica: repositorios cuyo `search_vector` contiene alguna de las
 * palabras (como prefijo), ordenados por `ts_rank_cd`, con los campos y las
 * palabras que coinciden para explicar el resultado.
 */
export async function lexicalCandidates(
  db: Database,
  scope: SearchScope,
  terms: string[],
): Promise<LexicalCandidate[]> {
  const tsquery = prefixTsQuery(terms)
  if (!tsquery) return []
  const query = toTsQuery(tsquery)
  const fieldFlags = sql.join(
    SEARCH_FIELDS.map(
      (field) =>
        sql`case when ${toTsVector(SEARCH_FIELD_SOURCES[field].text)} @@ ${query} then ${field} end`,
    ),
    sql`, `,
  )
  const termFlags = sql.join(
    terms.map(
      (term) =>
        sql`case when ${repositories.searchVector} @@ ${toTsQuery(`${term}:*`)} then ${term} end`,
    ),
    sql`, `,
  )
  return db
    .select({
      id: repositories.id,
      fields: sql<SearchField[]>`array_remove(array[${fieldFlags}]::text[], null)`,
      terms: sql<string[]>`array_remove(array[${termFlags}]::text[], null)`,
    })
    .from(repositories)
    .where(and(sql`${repositories.searchVector} @@ ${query}`, ...conditions(scope)))
    .orderBy(
      desc(sql`ts_rank_cd(${repositories.searchVector}, ${query})`),
      desc(repositories.stars),
      asc(repositories.id),
    )
    .limit(CANDIDATES_PER_LIST)
}

/**
 * La lista semántica: repositorios con embedding del mismo modelo que la
 * consulta, por similitud de coseno descendente, y solo por encima del umbral
 * del modelo. Sin umbral, todo repositorio con embedding sería «parecido» a
 * cualquier consulta, y una búsqueda sin sentido nunca se quedaría vacía.
 */
export async function semanticCandidates(
  db: Database,
  scope: SearchScope,
  embedding: { vector: number[]; model: string; minSimilarity: number },
): Promise<SemanticCandidate[]> {
  const distance = cosineDistance(repositoryEmbeddings.embedding, embedding.vector)
  const rows = await db
    .select({ id: repositories.id, similarity: sql<number>`1 - (${distance})` })
    .from(repositories)
    .innerJoin(
      repositoryEmbeddings,
      and(
        eq(repositoryEmbeddings.repositoryId, repositories.id),
        eq(repositoryEmbeddings.model, embedding.model),
      ),
    )
    .where(and(sql`1 - (${distance}) >= ${embedding.minSimilarity}`, ...conditions(scope)))
    .orderBy(asc(distance), asc(repositories.id))
    .limit(CANDIDATES_PER_LIST)
  return rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) }))
}
