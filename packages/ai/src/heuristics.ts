import type { AbandonmentRisk, AbandonmentRiskSource } from '@rgm/shared'

/**
 * Riesgo de abandono por heurística transparente (docs/data-model.md, specs/ai
 * · «Riesgo de abandono como valoración»): `HIGH` si GitHub lo marca archivado
 * o no hay push en 18 meses, `MEDIUM` sin push en 6 meses, `LOW` con push en
 * los últimos 6 meses, `UNKNOWN` sin fecha de push. Meses de calendario,
 * contados hacia atrás desde `now`.
 */
export function heuristicAbandonmentRisk(
  repository: { archived: boolean; githubPushedAt: Date | null },
  now: Date = new Date(),
): AbandonmentRisk {
  if (repository.archived) return 'HIGH'
  if (!repository.githubPushedAt) return 'UNKNOWN'
  const pushed = repository.githubPushedAt.getTime()
  if (pushed < monthsBefore(now, 18)) return 'HIGH'
  if (pushed < monthsBefore(now, 6)) return 'MEDIUM'
  return 'LOW'
}

/**
 * La valoración que se muestra: la heurística manda siempre que tenga datos,
 * diga lo que diga la IA; la de la IA solo cubre el hueco de `UNKNOWN`. La
 * fuente viaja con el valor para que la interfaz la etiquete.
 */
export function abandonmentAssessment(
  repository: { archived: boolean; githubPushedAt: Date | null },
  aiRisk: AbandonmentRisk | null,
  now: Date = new Date(),
): { risk: AbandonmentRisk; source: AbandonmentRiskSource } {
  const risk = heuristicAbandonmentRisk(repository, now)
  if (risk === 'UNKNOWN' && aiRisk && aiRisk !== 'UNKNOWN') return { risk: aiRisk, source: 'AI' }
  return { risk, source: 'HEURISTIC' }
}

function monthsBefore(now: Date, months: number): number {
  const d = new Date(now.getTime())
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.getTime()
}
