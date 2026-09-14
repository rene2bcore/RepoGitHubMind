import { createHash } from 'node:crypto'

/** Lo que entra en la representación semántica de un repositorio global. Nada personal. */
export type SemanticSource = {
  fullName: string
  description: string | null
  summary: string | null
  purpose: string | null
  mainUseCases: string[]
  /** `Nombre (ruta)` de cada categoría del catálogo. */
  categories: string[]
  /** Tags de IA. */
  tags: string[]
  topics: string[]
}

/** Muy por debajo de los 8191 tokens del modelo de PA-3: el texto nunca se recorta por la API. */
export const MAX_SEMANTIC_TEXT_CHARS = 8000

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
const sortedUnique = (values: string[]) =>
  [...new Set(values.map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'))

/**
 * Una sola representación semántica por repositorio, con nombre, descripción,
 * resumen, propósito, casos de uso, categorías, tags y topics (specs/search ·
 * «Qué se vectoriza»). Es estable a propósito: los espacios se normalizan y
 * categorías, tags y topics se ordenan, así que el orden en que GitHub o la
 * IA los devuelvan no cambia el texto ni obliga a revectorizar. Los casos de
 * uso conservan su orden, que es el de la IA. No se vectoriza el repositorio
 * completo ni el README (§22).
 */
export function buildSemanticText(source: SemanticSource): string {
  const line = (label: string, value: string | null) =>
    value && clean(value) ? `${label}: ${clean(value)}` : null
  const list = (label: string, values: string[]) =>
    values.length ? `${label}: ${values.join('; ')}` : null
  return [
    line('Repositorio', source.fullName),
    line('Descripción', source.description),
    line('Resumen', source.summary),
    line('Propósito', source.purpose),
    list('Casos de uso', source.mainUseCases.map(clean).filter(Boolean)),
    list('Categorías', sortedUnique(source.categories)),
    list('Tags', sortedUnique(source.tags)),
    list('Topics', sortedUnique(source.topics)),
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
    .slice(0, MAX_SEMANTIC_TEXT_CHARS)
}

/** SHA-256 del texto: lo que se guarda en `repository_embeddings.source_hash`. */
export function semanticTextHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Si el embedding guardado sirve (specs/search · «Texto sin cambios», CA-9):
 * mismo texto y mismo modelo. Un modelo distinto obliga a revectorizar aunque
 * el texto no cambie, porque solo se comparan vectores del mismo modelo.
 */
export function embeddingIsCurrent(
  stored: { sourceHash: string; model: string } | null,
  next: { sourceHash: string; model: string },
): boolean {
  return stored !== null && stored.sourceHash === next.sourceHash && stored.model === next.model
}
