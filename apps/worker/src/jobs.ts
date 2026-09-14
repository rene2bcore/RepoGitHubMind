import { claimJob, completeJob, failJob, type Job } from '@rgm/db'
import { analyzeRepositoryJob } from './analyze'
import { generateEmbeddingJob } from './embed'

export type JobResult = { job: Job; outcome: 'completed' | 'requeued' | 'failed' }

type Handler = (job: Job) => Promise<unknown>

/**
 * Un manejador por tipo de trabajo (ADR-0010). Todos idempotentes: repetir
 * un trabajo produce el mismo estado. Guardar un repositorio nunca espera a
 * ninguno: la web encola y responde.
 */
const handlers: Record<string, Handler> = {
  ANALYZE_REPOSITORY: (job) => analyzeRepositoryJob(job),
  GENERATE_EMBEDDING: (job) => generateEmbeddingJob(job),
}

/**
 * Toma un trabajo y lo ejecuta. Devuelve `null` si la cola estaba vacía. Un
 * fallo vuelve a la cola con backoff o queda `FAILED` al agotar intentos o si
 * el error no es reintentable; un `retryAfter` en el error (la ventana de
 * GitHub o del proveedor de IA) se respeta tal cual.
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
