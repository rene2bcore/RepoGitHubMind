/**
 * La constante de Reciprocal Rank Fusion. 60 es el valor del artículo
 * original (Cormack, Clarke y Büttcher, 2009) y el que usan por defecto los
 * motores que la implementan: amortigua la diferencia entre el primer puesto
 * y los siguientes, de modo que aparecer en las dos listas pesa más que ser
 * primero en una sola.
 */
export const RRF_K = 60

export type Fused = {
  id: string
  score: number
  /** Puesto (desde 1) en cada lista, en el orden en que se pasaron; null si no aparece. */
  ranks: (number | null)[]
}

/**
 * Fusiona listas ordenadas de ids con RRF: cada id suma `1 / (k + puesto)`
 * por cada lista en la que aparece (specs/search · «Búsqueda híbrida»). No
 * mira puntuaciones, solo puestos, así que no hace falta que la puntuación
 * léxica y la similitud de coseno estén en la misma escala. Un id repetido
 * dentro de una lista cuenta solo en su primer puesto.
 *
 * Empates, en este orden: mejor puesto en cualquiera de las listas; aparecer
 * antes en la primera lista que lo contiene (se pasa primero la léxica, y
 * una coincidencia de palabras se explica mejor que un parecido); y el id,
 * para que el orden sea el mismo en cada ejecución.
 */
export function fuseRankings(lists: string[][], k = RRF_K): Fused[] {
  const fused = new Map<string, Fused>()
  lists.forEach((list, listIndex) => {
    const seen = new Set<string>()
    let rank = 0
    for (const id of list) {
      if (seen.has(id)) continue
      seen.add(id)
      rank += 1
      const entry = fused.get(id) ?? { id, score: 0, ranks: lists.map(() => null) }
      entry.score += 1 / (k + rank)
      entry.ranks[listIndex] = rank
      fused.set(id, entry)
    }
  })
  const best = (f: Fused) => Math.min(...f.ranks.map((r) => r ?? Infinity))
  const firstList = (f: Fused) => f.ranks.findIndex((r) => r !== null)
  return [...fused.values()].sort(
    (a, b) =>
      b.score - a.score ||
      best(a) - best(b) ||
      firstList(a) - firstList(b) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}
