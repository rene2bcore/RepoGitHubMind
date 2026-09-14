import type { CatalogCategory } from './provider'

/**
 * Mapea las categorías que sugiere la IA al catálogo controlado
 * (docs/taxonomy.md, specs/ai · «Categorías del catálogo»). La IA nunca crea
 * categorías: lo que no mapea vuelve en `unmapped` para guardarse como tag y
 * contarse.
 *
 * Una sugerencia casa, de más a menos fuerte, con la ruta completa
 * (`data/databases/vector`), con el slug, con el nombre o con un sinónimo,
 * ignorando mayúsculas, acentos y separadores. Además, un término del
 * catálogo de dos o más palabras casa si aparece entero dentro de la
 * sugerencia: «vector similarity search» contiene «similarity search». Un
 * término de una sola palabra no casa por contención, porque «memory» dentro
 * de «memory safety» no es memoria de agentes. Si varias categorías casan,
 * gana el término más largo; a igualdad, slug antes que nombre y nombre
 * antes que sinónimo.
 */
export function mapCategories<T extends CatalogCategory>(
  suggestions: string[],
  catalog: T[],
): { mapped: T[]; unmapped: string[] } {
  const mapped: T[] = []
  const unmapped: string[] = []
  for (const suggestion of suggestions) {
    const match = bestMatch(suggestion, catalog)
    if (!match) {
      if (suggestion.trim()) unmapped.push(suggestion.trim())
      continue
    }
    if (!mapped.some((c) => c.id === match.id)) mapped.push(match)
  }
  return { mapped, unmapped }
}

/** Minúsculas, sin acentos, y cualquier cosa que no sea letra o número como un espacio. */
export function normalizeTerm(term: string): string {
  return term
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const BONUS = { slug: 3, name: 2, synonym: 1 } as const

function bestMatch<T extends CatalogCategory>(suggestion: string, catalog: T[]): T | null {
  const asPath = suggestion
    .toLowerCase()
    .split(/\s*[/>]\s*/)
    .map(normalizeTerm)
    .map((segment) => segment.replace(/ /g, '-'))
    .join('/')
  const byPath = catalog.find((c) => c.path === asPath)
  if (byPath) return byPath

  const words = normalizeTerm(suggestion).split(' ').filter(Boolean)
  if (!words.length) return null
  let best: { category: T; score: number } | null = null
  for (const category of catalog) {
    const terms: [string, keyof typeof BONUS][] = [
      [category.slug, 'slug'],
      [category.name, 'name'],
      ...category.synonyms.map((s): [string, keyof typeof BONUS] => [s, 'synonym']),
    ]
    for (const [term, kind] of terms) {
      const termWords = normalizeTerm(term).split(' ').filter(Boolean)
      if (!termWords.length) continue
      const exact = termWords.join(' ') === words.join(' ')
      const contained = termWords.length >= 2 && containsSequence(words, termWords)
      if (!exact && !contained) continue
      const score = (exact ? 100 : 0) + termWords.length * 10 + BONUS[kind]
      if (!best || score > best.score) best = { category, score }
    }
  }
  return best?.category ?? null
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((w, j) => haystack[i + j] === w)) return true
  }
  return false
}
