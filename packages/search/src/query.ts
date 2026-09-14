/**
 * Palabras vacías en castellano e inglés, los dos idiomas en que llegan las
 * consultas. Con la configuración `simple` PostgreSQL no quita ninguna, y en
 * una consulta en OR «de» o «the» coincidirían con casi todo.
 */
const STOPWORDS = new Set(
  (
    'a al algo como con de del el ella en entre es esa ese eso esta este esto hay la las lo los mas más me mi mis muy no o para pero por que qué se ser si sin sobre son su sus te tu un una uno unos unas y ya ' +
    'an and any are as at be but by can do for from has have how i in into is it its of on or so than that the their them there these this to use was what when which who why will with you your'
  ).split(' '),
)

export const MAX_QUERY_TERMS = 12

/**
 * Las palabras de una consulta que buscan en `search_vector`: en minúsculas,
 * partidas por todo lo que no sea letra o número (como hace el analizador
 * `simple` de PostgreSQL con «similarity-search»), sin palabras vacías, sin
 * repetir y de dos caracteres o más. Los acentos se conservan: `simple` no
 * los quita, y «búsqueda» no es «busqueda» ni en el documento ni aquí.
 */
export function lexicalTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
  return [...new Set(words)].slice(0, MAX_QUERY_TERMS)
}

/**
 * La consulta en la sintaxis de `to_tsquery`: cada palabra como prefijo y
 * todas en OR («postgres» encuentra «postgresql»; «agent», «agents»). En OR
 * porque la parte léxica aporta candidatos y el orden lo decide RRF: exigir
 * todas las palabras dejaría fuera lo que coincide en casi todas. Los
 * términos solo tienen letras y números, así que no hay operadores que
 * escapar. `null` si no queda ninguna palabra.
 */
export function prefixTsQuery(terms: string[]): string | null {
  return terms.length ? terms.map((t) => `${t}:*`).join(' | ') : null
}
