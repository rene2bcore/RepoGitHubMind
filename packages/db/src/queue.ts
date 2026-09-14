import { and, eq, sql } from 'drizzle-orm'
import { getDb, type Database } from './client'
import { backgroundJobs, JOB_TYPE_VALUES } from './schema'

export type JobType = (typeof JOB_TYPE_VALUES)[number]
export type Job = typeof backgroundJobs.$inferSelect

/**
 * Cola de trabajos sobre `background_jobs` (ADR-0010). Sin Redis: una tabla,
 * `FOR UPDATE SKIP LOCKED` para que varios workers no tomen el mismo trabajo,
 * y backoff exponencial en `run_after` al fallar.
 *
 * Encolar es idempotente por diseño: el índice único parcial sobre
 * `(type, repository_id)` mientras el trabajo está `QUEUED` o `PROCESSING`
 * hace que un segundo encolado del mismo trabajo no cree otra fila.
 */
export async function enqueueJob(
  type: JobType,
  repositoryId: string | null,
  payload: Record<string, unknown> = {},
  db: Database = getDb(),
): Promise<{ enqueued: boolean }> {
  const rows = await db
    .insert(backgroundJobs)
    .values({ type, repositoryId, payload })
    .onConflictDoNothing()
    .returning({ id: backgroundJobs.id })
  return { enqueued: rows.length > 0 }
}

/**
 * Toma el siguiente trabajo listo, o `null` si no hay ninguno. La fila queda
 * `PROCESSING` con el intento contado en la misma sentencia, así que un
 * segundo worker no la ve.
 */
export async function claimJob(db: Database = getDb()): Promise<Job | null> {
  const rows = await db.execute<Job>(sql`
    update background_jobs
    set status = 'PROCESSING', attempts = attempts + 1, updated_at = now()
    where id = (
      select id from background_jobs
      where status = 'QUEUED' and run_after <= now()
      order by created_at
      limit 1
      for update skip locked
    )
    returning
      id, type, repository_id as "repositoryId", status, payload, attempts,
      max_attempts as "maxAttempts", last_error as "lastError", run_after as "runAfter",
      created_at as "createdAt", updated_at as "updatedAt"
  `)
  return rows[0] ?? null
}

export async function completeJob(id: string, db: Database = getDb()): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({ status: 'COMPLETED', lastError: null, updatedAt: new Date() })
    .where(eq(backgroundJobs.id, id))
}

/**
 * Un fallo vuelve a la cola con backoff exponencial (30 s, 60 s, 120 s…)
 * hasta agotar `max_attempts`; después queda `FAILED` con el último error.
 * Con `retryAfter` (por ejemplo, la ventana de rate limit de GitHub) se
 * respeta esa fecha en vez del backoff. Un error con `retryable: false` (una
 * salida de IA que no validó dos veces, una clave rechazada) queda `FAILED`
 * al primer intento: repetirlo daría lo mismo y costaría otra vez.
 */
export async function failJob(
  job: Pick<Job, 'id' | 'attempts' | 'maxAttempts'>,
  error: unknown,
  retryAfter?: Date,
  db: Database = getDb(),
): Promise<'requeued' | 'failed'> {
  const message = error instanceof Error ? error.message : String(error)
  const permanent =
    error instanceof Error &&
    'retryable' in error &&
    (error as { retryable: unknown }).retryable === false
  const exhausted = permanent || job.attempts >= job.maxAttempts
  const backoffMs = 30_000 * 2 ** Math.max(0, job.attempts - 1)
  const runAfter = retryAfter ?? new Date(Date.now() + backoffMs)
  await db
    .update(backgroundJobs)
    .set(
      exhausted
        ? { status: 'FAILED', lastError: message, updatedAt: new Date() }
        : { status: 'QUEUED', lastError: message, runAfter, updatedAt: new Date() },
    )
    .where(and(eq(backgroundJobs.id, job.id), eq(backgroundJobs.status, 'PROCESSING')))
  return exhausted ? 'failed' : 'requeued'
}
