import type { SearchField } from '@rgm/shared'

const FIELD_LABELS: Record<Exclude<SearchField, 'categories'>, string> = {
  name: 'el nombre',
  description: 'la descripción',
  topics: 'los topics',
  summary: 'el resumen',
  purpose: 'el propósito',
  useCases: 'los casos de uso',
  tags: 'los tags',
}

/** «a», «a y b», «a, b y c». */
function joinSpanish(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

const MAX_ABOUT = 110

export type MatchExplanationInput = {
  /** Las palabras de la consulta que coinciden en el documento léxico. */
  terms: string[]
  /** Los campos en los que coinciden, en el orden de `SEARCH_FIELDS`. */
  fields: SearchField[]
  /** Si entró por similitud de coseno por encima del umbral del modelo. */
  semantic: boolean
  /** Nombres de las categorías del repositorio. */
  categories: string[]
  /** De qué va el repositorio: su resumen o su descripción. */
  about: string | null
}

/**
 * El «Por qué» de un resultado, en una línea (specs/search · «Resultado
 * legible»). Dice lo que se sabe y nada más: en qué campos coincidieron qué
 * palabras, en qué categoría, si además se parece por significado, y, si
 * solo entró por significado, de qué va para que se entienda el parecido. No
 * da números: una similitud de coseno no significa nada para quien busca.
 */
export function explainMatch(input: MatchExplanationInput): string {
  const places = input.fields.map((field) => {
    if (field !== 'categories') return FIELD_LABELS[field]
    if (input.categories.length === 1) return `la categoría ${input.categories[0]}`
    return input.categories.length
      ? `las categorías ${joinSpanish(input.categories)}`
      : 'las categorías'
  })
  if (places.length) {
    const terms = input.terms.slice(0, 3).map((t) => `«${t}»`)
    const lexical = `Coincide ${terms.length ? `${joinSpanish(terms)} ` : ''}en ${joinSpanish(places)}`
    return input.semantic ? `${lexical}, y se parece por significado a lo que buscas` : lexical
  }
  if (input.semantic) {
    const about = input.about?.replace(/\s+/g, ' ').trim()
    if (!about) return 'Se parece por significado a lo que buscas'
    const clipped = about.length > MAX_ABOUT ? `${about.slice(0, MAX_ABOUT - 1).trimEnd()}…` : about
    return `Se parece por significado a lo que buscas: ${clipped}`
  }
  return 'Coincide con tu búsqueda'
}
