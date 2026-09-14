import { eq } from 'drizzle-orm'
import { claimJob, completeJob, failJob, getDb, repositoryAnalyses, type Job } from '@rgm/db'
import { readEnv } from '@rgm/shared'

export type JobResult = { job: Job; outcome: 'completed' | 'requeued' | 'failed' }

type Handler = (job: Job) => Promise<void>

/**
 * Un manejador por tipo de trabajo (ADR-0010). Todos idempotentes: repetir
 * un trabajo produce el mismo estado.
 *
 * `ANALYZE_REPOSITORY` en H2 solo decide el estado del análisis: `DISABLED`
 * con la IA apagada, y `FAILED` con motivo mientras no exista el proveedor
 * (llega con H4 · RGM-5). Guardar un repositorio nunca depende de esto.
 */
const handlers: Record<string, Handler> = {
  ANALYZE_REPOSITORY: async (job) => {
    if (!job.repositoryId) return
    const env = readEnv()
    const status = env.AI_ANALYSIS_ENABLED ? 'FAILED' : 'DISABLED'
    const lastError = env.AI_ANALYSIS_ENABLED
      ? 'El análisis de IA llega con H4 (RGM-5): todavía no hay proveedor'
      : null
    await getDb()
      .update(repositoryAnalyses)
      .set({ status, lastError, updatedAt: new Date() })
      .where(eq(repositoryAnalyses.repositoryId, job.repositoryId))
  },
}

/**
 * Toma un trabajo y lo ejecuta. Devuelve `null` si la cola estaba vacía. Un
 * fallo vuelve a la cola con backoff o queda `FAILED` al agotar intentos; un
 * `retryAfter` en el error (la ventana de GitHub) se respeta tal cual.
 */
export async function processNextJob(): Promise<JobResult | null> {
  const job = await claimJob()
  if (!job) return null
  const handler = handlers[job.type]
  try {
    if (!handler) throw new Error(`sin manejador para ${job.type}`)
    await handler(job)
    await completeJob(job.id)
    return { job, outcome: 'completed' }
  } catch (error) {
    const retryAfter =
      error instanceof Error && 'retryAfter' in error && error.retryAfter instanceof Date
        ? error.retryAfter
        : undefined
    const outcome = await failJob(job, error, retryAfter)
    return { job, outcome }
  }
}

/** Solo para pruebas: sustituir un manejador. */
export function setHandler(type: string, handler: Handler | null): void {
  if (handler) handlers[type] = handler
  else delete handlers[type]
}
