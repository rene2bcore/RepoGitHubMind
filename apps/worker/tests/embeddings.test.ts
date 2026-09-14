import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  AIProviderCallError,
  FakeAIProvider,
  FakeEmbeddingProvider,
  setAIProvider,
  setEmbeddingProvider,
  type EmbeddingOutcome,
} from '@rgm/ai'
import {
  aiUsage,
  backgroundJobs,
  closeDb,
  databaseUrlForEnv,
  enqueueJob,
  getDb,
  repositories,
  repositoryAnalyses,
  repositoryEmbeddings,
} from '@rgm/db'
import { truncateAllTables } from '@rgm/db/migrate'
import { FIXTURES } from '@rgm/github'
import { resetEnvCache } from '@rgm/shared'
import { processNextJob } from '../src/jobs'

/**
 * specs/search · «Qué se vectoriza» y «Texto sin cambios» (CA-9), y «Sin
 * embedding todavía» del lado del worker: `GENERATE_EMBEDDING` contra la base
 * de pruebas, con el proveedor falso y sin red.
 */
describe('GENERATE_EMBEDDING', () => {
  let repositoryId: string
  let embeddings: FakeEmbeddingProvider

  const embeddingUsage = () =>
    getDb()
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.repositoryId, repositoryId), eq(aiUsage.operation, 'EMBEDDING')))
      .orderBy(aiUsage.createdAt)
  const stored = async () => {
    const [row] = await getDb()
      .select({
        model: repositoryEmbeddings.model,
        sourceHash: repositoryEmbeddings.sourceHash,
        dimensions: sql<number>`vector_dims(${repositoryEmbeddings.embedding})`,
      })
      .from(repositoryEmbeddings)
      .where(eq(repositoryEmbeddings.repositoryId, repositoryId))
    return row ?? null
  }
  const vectorizar = async () => {
    await enqueueJob('GENERATE_EMBEDDING', repositoryId)
    return processNextJob()
  }

  beforeAll(async () => {
    await truncateAllTables(databaseUrlForEnv())
    Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'true' })
    resetEnvCache()
  })
  beforeEach(async () => {
    const db = getDb()
    await db.delete(backgroundJobs)
    await db.delete(aiUsage)
    await db.delete(repositories)
    const [row] = await db
      .insert(repositories)
      .values({ ...FIXTURES['pgvector/pgvector']!, metadataRefreshedAt: new Date() })
      .returning({ id: repositories.id })
    repositoryId = row!.id
    await db.insert(repositoryAnalyses).values({ repositoryId, status: 'PENDING' })
    setAIProvider(new FakeAIProvider())
    embeddings = new FakeEmbeddingProvider()
    setEmbeddingProvider(embeddings)
  })
  afterAll(async () => {
    Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'false' })
    resetEnvCache()
    setAIProvider(null)
    setEmbeddingProvider(null)
    await closeDb()
  })

  it('completar un análisis reescribe search_vector con el resumen y encola el embedding, que se guarda con 1536 dimensiones, modelo, hash y su fila de ai_usage', async () => {
    await enqueueJob('ANALYZE_REPOSITORY', repositoryId)
    expect((await processNextJob())?.job.type).toBe('ANALYZE_REPOSITORY')

    const [lexico] = await getDb()
      .select({
        resumen: sql<boolean>`${repositories.searchVector} @@ to_tsquery('simple', 'resumen')`,
        categoria: sql<boolean>`${repositories.searchVector} @@ to_tsquery('simple', 'databases')`,
      })
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
    expect(lexico).toEqual({ resumen: true, categoria: true })

    const [trabajo] = await getDb()
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.status, 'QUEUED'))
    expect(trabajo).toMatchObject({ type: 'GENERATE_EMBEDDING', repositoryId })
    expect(await processNextJob()).toMatchObject({ outcome: 'completed' })

    expect(await stored()).toMatchObject({ model: 'fake-embedding', dimensions: 1536 })
    expect((await stored())!.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    const [texto] = embeddings.requests
    expect(texto![0]).toContain('Repositorio: pgvector/pgvector')
    expect(texto![0]).toContain('Resumen: Resumen de prueba')
    expect(texto![0]).toContain('Categorías: Vector (data/databases/vector)')
    expect(await embeddingUsage()).toEqual([
      expect.objectContaining({
        provider: 'fake',
        model: 'fake-embedding',
        success: true,
        outputTokens: 0,
      }),
    ])
  })

  it('con el texto y el modelo sin cambios no se pide otro embedding ni se registra coste; si cambia el resumen o el modelo, sí', async () => {
    expect((await vectorizar())?.outcome).toBe('completed')
    const primero = await stored()
    expect(embeddings.requests).toHaveLength(1)

    expect((await vectorizar())?.outcome).toBe('completed')
    expect(embeddings.requests).toHaveLength(1)
    expect(await embeddingUsage()).toHaveLength(1)
    expect(await stored()).toEqual(primero)

    await getDb()
      .update(repositoryAnalyses)
      .set({ summary: 'Un resumen distinto.', status: 'COMPLETED' })
      .where(eq(repositoryAnalyses.repositoryId, repositoryId))
    expect((await vectorizar())?.outcome).toBe('completed')
    expect(embeddings.requests).toHaveLength(2)
    expect((await stored())!.sourceHash).not.toBe(primero!.sourceHash)

    setEmbeddingProvider(new FakeEmbeddingProvider({ model: 'otro-modelo' }))
    expect((await vectorizar())?.outcome).toBe('completed')
    expect((await stored())!.model).toBe('otro-modelo')
    expect(await embeddingUsage()).toHaveLength(3)
  })

  it('proveedor caído: vuelve a la cola y la llamada cuenta; un error no reintentable, FAILED al primer intento sin guardar; con la IA apagada, nada', async () => {
    setEmbeddingProvider(
      new FakeEmbeddingProvider({
        responses: [new AIProviderCallError('OpenRouter respondió 503', { retryable: true })],
      }),
    )
    expect((await vectorizar())?.outcome).toBe('requeued')
    expect(await stored()).toBeNull()
    expect((await embeddingUsage()).map((u) => u.success)).toEqual([false])

    await getDb().delete(backgroundJobs)
    const dimension = 'OpenRouter devolvió un embedding de 768 dimensiones y el esquema espera 1536'
    setEmbeddingProvider(
      new FakeEmbeddingProvider({
        responses: [new AIProviderCallError(dimension, { retryable: false })],
      }),
    )
    expect((await vectorizar())?.outcome).toBe('failed')
    expect(await stored()).toBeNull()
    const [fallido] = await getDb().select().from(backgroundJobs)
    expect(fallido).toMatchObject({ status: 'FAILED', attempts: 1, lastError: dimension })

    await getDb().delete(backgroundJobs)
    Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'false' })
    resetEnvCache()
    try {
      setEmbeddingProvider(embeddings)
      expect((await vectorizar())?.outcome).toBe('completed')
    } finally {
      Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'true' })
      resetEnvCache()
    }
    expect(embeddings.requests).toHaveLength(0)
    expect(await stored()).toBeNull()
  })

  it('si el texto cambia mientras se vectoriza, el trabajo vuelve a pedirlo y lo guardado es del texto vigente', async () => {
    const base = new FakeEmbeddingProvider()
    let llamadas = 0
    setEmbeddingProvider({
      name: base.name,
      model: base.model,
      dimensions: base.dimensions,
      minSimilarity: base.minSimilarity,
      async embed(texts: string[]): Promise<EmbeddingOutcome> {
        llamadas += 1
        // Un reanálisis que termina en otro worker justo durante la primera llamada.
        if (llamadas === 1) {
          await getDb()
            .update(repositoryAnalyses)
            .set({ summary: 'Resumen del reanálisis.', status: 'COMPLETED' })
            .where(eq(repositoryAnalyses.repositoryId, repositoryId))
        }
        return base.embed(texts)
      },
    })
    expect((await vectorizar())?.outcome).toBe('completed')
    expect(llamadas).toBe(2)
    expect(base.requests[1]![0]).toContain('Resumen: Resumen del reanálisis.')
    expect(await embeddingUsage()).toHaveLength(2)
  })
})
