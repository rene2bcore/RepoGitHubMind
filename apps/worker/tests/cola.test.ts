import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  backgroundJobs,
  closeDb,
  databaseUrlForEnv,
  enqueueJob,
  getDb,
  repositories,
  repositoryAnalyses,
} from '@rgm/db'
import { truncateAllTables } from '@rgm/db/migrate'
import { FIXTURES } from '@rgm/github'
import { processNextJob, setHandler } from '../src/jobs'

/**
 * ADR-0010 · Cola de trabajos en PostgreSQL: encolar es idempotente, un
 * fallo vuelve con backoff, agotar intentos o un error no reintentable deja
 * FAILED, y una ventana de reintento se respeta. specs/repositories · «La IA
 * falla»: con la IA apagada el análisis queda DISABLED y el repositorio sigue
 * usable. El análisis con proveedor está en `analisis.test.ts`.
 */
describe('cola de trabajos', () => {
  let repositoryId: string

  beforeAll(async () => {
    await truncateAllTables(databaseUrlForEnv())
    const data = FIXTURES['pgvector/pgvector']!
    const [row] = await getDb()
      .insert(repositories)
      .values({ ...data, metadataRefreshedAt: new Date() })
      .returning({ id: repositories.id })
    repositoryId = row!.id
    await getDb().insert(repositoryAnalyses).values({ repositoryId, status: 'PENDING' })
  })
  beforeEach(async () => {
    await getDb().delete(backgroundJobs)
    setHandler('PRUEBA', null)
  })
  afterAll(() => closeDb())

  it('encolar el mismo trabajo dos veces deja una sola fila activa', async () => {
    expect(await enqueueJob('ANALYZE_REPOSITORY', repositoryId)).toEqual({ enqueued: true })
    expect(await enqueueJob('ANALYZE_REPOSITORY', repositoryId)).toEqual({ enqueued: false })
    const rows = await getDb().select().from(backgroundJobs)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'QUEUED', attempts: 0 })
  })

  it('con la IA apagada, ANALYZE_REPOSITORY deja el análisis DISABLED y completa el trabajo', async () => {
    await enqueueJob('ANALYZE_REPOSITORY', repositoryId)
    const result = await processNextJob()
    expect(result?.outcome).toBe('completed')
    const [analysis] = await getDb()
      .select()
      .from(repositoryAnalyses)
      .where(eq(repositoryAnalyses.repositoryId, repositoryId))
    expect(analysis?.status).toBe('DISABLED')
    // Completado el trabajo, se puede volver a encolar: la unicidad es solo
    // sobre los activos.
    expect(await enqueueJob('ANALYZE_REPOSITORY', repositoryId)).toEqual({ enqueued: true })
  })

  it('un error que se declara no reintentable queda FAILED al primer intento, sin volver a la cola', async () => {
    setHandler('PRUEBA', async () => {
      throw Object.assign(new Error('la salida no validó dos veces'), { retryable: false })
    })
    await getDb()
      .insert(backgroundJobs)
      .values({ type: 'PRUEBA' as never, repositoryId })
    expect((await processNextJob())?.outcome).toBe('failed')
    const [job] = await getDb().select().from(backgroundJobs)
    expect(job).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      lastError: 'la salida no validó dos veces',
    })
  })

  it('un fallo vuelve a la cola con run_after en el futuro, y al agotar intentos queda FAILED', async () => {
    let veces = 0
    setHandler('PRUEBA', async () => {
      veces += 1
      throw new Error(`fallo ${veces}`)
    })
    await getDb()
      .insert(backgroundJobs)
      .values({ type: 'PRUEBA' as never, repositoryId, maxAttempts: 2 })

    const primero = await processNextJob()
    expect(primero?.outcome).toBe('requeued')
    let [job] = await getDb().select().from(backgroundJobs)
    expect(job).toMatchObject({ status: 'QUEUED', attempts: 1, lastError: 'fallo 1' })
    expect(job!.runAfter.getTime()).toBeGreaterThan(Date.now() + 20_000)

    // Todavía no toca: la cola no lo entrega.
    expect(await processNextJob()).toBeNull()

    await getDb()
      .update(backgroundJobs)
      .set({ runAfter: new Date(0) })
    const segundo = await processNextJob()
    expect(segundo?.outcome).toBe('failed')
    ;[job] = await getDb().select().from(backgroundJobs)
    expect(job).toMatchObject({ status: 'FAILED', attempts: 2, lastError: 'fallo 2' })
  })

  it('un error con retryAfter (la ventana de GitHub) fija esa fecha, no el backoff', async () => {
    const ventana = new Date(Date.now() + 3_600_000)
    setHandler('PRUEBA', async () => {
      throw Object.assign(new Error('límite de GitHub'), { retryAfter: ventana })
    })
    await getDb()
      .insert(backgroundJobs)
      .values({ type: 'PRUEBA' as never, repositoryId })
    expect((await processNextJob())?.outcome).toBe('requeued')
    const [job] = await getDb().select().from(backgroundJobs)
    expect(job!.runAfter.getTime()).toBe(ventana.getTime())
  })

  it('dos workers no toman el mismo trabajo', async () => {
    let ejecuciones = 0
    setHandler('PRUEBA', async () => {
      ejecuciones += 1
      await new Promise((r) => setTimeout(r, 50))
    })
    await getDb()
      .insert(backgroundJobs)
      .values({ type: 'PRUEBA' as never, repositoryId })
    const [a, b] = await Promise.all([processNextJob(), processNextJob()])
    expect([a, b].filter(Boolean)).toHaveLength(1)
    expect(ejecuciones).toBe(1)
  })
})
