import type { AnalysisStatus } from '@rgm/shared'

export type CachedAnalysis = {
  status: AnalysisStatus
  aiAnalyzedAt: Date | null
  expiresAt: Date | null
}

export type StaleReason = 'forced' | 'missing' | 'not-completed' | 'expired' | 'changed'

/**
 * Por qué hay que (volver a) analizar un repositorio, o `null` si el análisis
 * guardado sirve para todas las cuentas (ADR-0009, specs/ai · «Un análisis
 * por repositorio»). Se reutiliza salvo que se fuerce, que no exista o no
 * esté completado, que haya caducado, o que el repositorio tenga pushes
 * posteriores al análisis. Es lo que hace sostenible el coste: la web lo
 * pregunta antes de encolar y el worker otra vez antes de llamar.
 */
export function analysisStaleReason(
  analysis: CachedAnalysis | null,
  repository: { githubPushedAt: Date | null },
  options: { now?: Date; force?: boolean } = {},
): StaleReason | null {
  const now = options.now ?? new Date()
  if (options.force) return 'forced'
  if (!analysis) return 'missing'
  if (analysis.status !== 'COMPLETED' || !analysis.aiAnalyzedAt) return 'not-completed'
  if (!analysis.expiresAt || analysis.expiresAt.getTime() <= now.getTime()) return 'expired'
  if (
    repository.githubPushedAt &&
    repository.githubPushedAt.getTime() > analysis.aiAnalyzedAt.getTime()
  ) {
    return 'changed'
  }
  return null
}

/** `expires_at` de un análisis hecho en `analyzedAt` con `AI_ANALYSIS_TTL_DAYS`. */
export function analysisExpiry(analyzedAt: Date, ttlDays: number): Date {
  return new Date(analyzedAt.getTime() + ttlDays * 86_400_000)
}
