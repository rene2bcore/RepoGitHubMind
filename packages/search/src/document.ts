import { eq, sql, type SQL } from 'drizzle-orm'
import {
  categories,
  repositories,
  repositoryAnalyses,
  repositoryCategories,
  repositoryTags,
  tags,
  type Database,
} from '@rgm/db'
import type { SearchField } from '@rgm/shared'

/**
 * La configuración de texto de PostgreSQL de toda la búsqueda léxica.
 * `simple` y no `english` ni `spanish`: el documento mezcla la metadata de
 * GitHub, casi siempre en inglés, con el análisis de IA, en castellano, y las
 * consultas llegan en los dos idiomas. Un stemmer aplicado al idioma que no es
 * produce raíces falsas, y su lista de palabras vacías borra palabras con
 * contenido del otro idioma. `simple` solo pasa a minúsculas; la morfología
 * («vectores» y «vector») y los sinónimos los cubre la parte semántica.
 */
export const TEXT_SEARCH_CONFIG = 'simple'

const analysisText = (column: SQL) =>
  sql`coalesce((select ${column} from ${repositoryAnalyses} where ${repositoryAnalyses.repositoryId} = ${repositories.id}), '')`

/**
 * Qué texto aporta cada campo al documento léxico y con qué peso (A pesa más
 * que D en `ts_rank_cd`). Todo sale del repositorio global y de su análisis;
 * nada de `user_repositories`: una nota no se busca nunca desde aquí
 * (specs/search · «Una nota ajena no se busca»). Las barras de `owner/name`
 * y de las rutas de categoría se cambian por espacios porque el analizador de
 * PostgreSQL toma `langchain-ai/langgraph` por una ruta y no separa
 * «langgraph».
 */
export const SEARCH_FIELD_SOURCES: Record<SearchField, { weight: 'A' | 'B' | 'C'; text: SQL }> = {
  name: { weight: 'A', text: sql`${repositories.owner} || ' ' || ${repositories.name}` },
  description: { weight: 'B', text: sql`coalesce(${repositories.description}, '')` },
  topics: { weight: 'B', text: sql`array_to_string(${repositories.topics}, ' ')` },
  categories: {
    weight: 'B',
    text: sql`coalesce((
      select string_agg(${categories.name} || ' ' || replace(${categories.path}, '/', ' '), ' ')
      from ${repositoryCategories}
      inner join ${categories} on ${categories.id} = ${repositoryCategories.categoryId}
      where ${repositoryCategories.repositoryId} = ${repositories.id}
    ), '')`,
  },
  summary: { weight: 'C', text: analysisText(sql`${repositoryAnalyses.summary}`) },
  purpose: { weight: 'C', text: analysisText(sql`${repositoryAnalyses.purpose}`) },
  useCases: {
    weight: 'C',
    text: analysisText(sql`array_to_string(${repositoryAnalyses.mainUseCases}, ' ')`),
  },
  tags: {
    weight: 'C',
    text: sql`coalesce((
      select string_agg(${tags.slug}, ' ')
      from ${repositoryTags}
      inner join ${tags} on ${tags.id} = ${repositoryTags.tagId}
      where ${repositoryTags.repositoryId} = ${repositories.id} and ${tags.kind} = 'AI'
    ), '')`,
  },
}

const config = sql.raw(`'${TEXT_SEARCH_CONFIG}'`)

export const toTsVector = (text: SQL) => sql`to_tsvector(${config}, ${text})`
export const toTsQuery = (query: string) => sql`to_tsquery(${config}, ${query})`

/** El documento léxico entero: cada campo con su peso, concatenados. */
export function searchDocument(): SQL {
  return sql.join(
    Object.values(SEARCH_FIELD_SOURCES).map(
      ({ weight, text }) => sql`setweight(${toTsVector(text)}, ${sql.raw(`'${weight}'`)})`,
    ),
    sql` || `,
  )
}

/**
 * Reescribe `search_vector` desde lo que hay ahora en la base. Se llama al
 * dar de alta o refrescar un repositorio (así un repositorio recién guardado
 * ya aparece por coincidencia léxica, sin esperar a la IA: specs/search ·
 * «Sin embedding todavía») y al completar su análisis, en la misma
 * transacción. Idempotente.
 */
export async function refreshSearchVector(
  db: Pick<Database, 'update'>,
  repositoryId: string,
): Promise<void> {
  await db
    .update(repositories)
    .set({ searchVector: searchDocument() })
    .where(eq(repositories.id, repositoryId))
}
