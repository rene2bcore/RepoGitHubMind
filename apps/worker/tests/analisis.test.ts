import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AIProviderCallError, FakeAIProvider, setAIProvider } from '@rgm/ai'
import {
  aiUsage,
  backgroundJobs,
  categories,
  closeDb,
  databaseUrlForEnv,
  enqueueJob,
  flattenTaxonomy,
  getDb,
  repositories,
  repositoryAnalyses,
  repositoryCategories,
  repositoryTags,
  tags,
} from '@rgm/db'
import { truncateAllTables } from '@rgm/db/migrate'
import { FIXTURES } from '@rgm/github'
import { resetEnvCache } from '@rgm/shared'
import { processNextJob } from '../src/jobs'

/**
 * specs/ai con el worker de verdad contra la base de pruebas y el proveedor
 * falso: «Salida válida», «Sugerencia mapeable», «Sugerencia que no existe»,
 * «Salida que se pasa de largo», «Proveedor caído», «IA desactivada»,
 * «Proveedor desconocido», «Coste por repositorio» y la mitad del worker de
 * «Un análisis por repositorio». La mitad de la web (segunda cuenta, cambio,
 * forzado) está en apps/web/tests/analisis.test.ts.
 */
const valida = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    summary: 'Un editor de texto en menos de mil líneas.',
    purpose: 'Enseñar cómo se escribe un editor de terminal.',
    mainUseCases: ['Aprender'],
    categories: [],
    tags: [],
    installationSummary: '',
    deploymentType: [],
    frameworks: [],
    maturity: 'estable',
    advantages: [],
    limitations: [],
    targetUsers: [],
    activityAssessment: '',
    abandonmentRisk: 'HIGH',
    aiConfidence: 0.7,
    ...overrides,
  })

describe('ANALYZE_REPOSITORY', () => {
  const ids: Record<string, string> = {}
  let ai: FakeAIProvider

  const analysisOf = async (fullName: string) => {
    const [row] = await getDb()
      .select()
      .from(repositoryAnalyses)
      .where(eq(repositoryAnalyses.repositoryId, ids[fullName]!))
    return row!
  }
  const usageOf = (fullName: string) =>
    getDb()
      .select()
      .from(aiUsage)
      .where(eq(aiUsage.repositoryId, ids[fullName]!))
      .orderBy(aiUsage.createdAt)
  const analizar = async (fullName: string, payload: Record<string, unknown> = {}) => {
    await enqueueJob('ANALYZE_REPOSITORY', ids[fullName]!, payload)
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
    await db.delete(tags)
    for (const data of Object.values(FIXTURES)) {
      const [row] = await db
        .insert(repositories)
        .values({ ...data, metadataRefreshedAt: new Date() })
        .returning({ id: repositories.id })
      ids[data.fullName] = row!.id
      await db.insert(repositoryAnalyses).values({ repositoryId: row!.id, status: 'PENDING' })
    }
    ai = new FakeAIProvider()
    setAIProvider(ai)
  })
  afterAll(async () => {
    Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'false' })
    resetEnvCache()
    setAIProvider(null)
    await closeDb()
  })

  it('salida válida: COMPLETED con proveedor, modelo y fechas, categoría del catálogo, tags y una fila de ai_usage', async () => {
    expect((await analizar('pgvector/pgvector'))?.outcome).toBe('completed')

    const analysis = await analysisOf('pgvector/pgvector')
    expect(analysis).toMatchObject({
      status: 'COMPLETED',
      provider: 'fake',
      model: 'fake-analysis',
      summary: expect.stringMatching(/^Resumen de prueba/),
      lastError: null,
    })
    expect(analysis.expiresAt!.getTime() - analysis.aiAnalyzedAt!.getTime()).toBe(90 * 86_400_000)

    const enCatalogo = await getDb()
      .select({
        path: categories.path,
        origin: repositoryCategories.origin,
        confidence: repositoryCategories.confidence,
      })
      .from(repositoryCategories)
      .innerJoin(categories, eq(categories.id, repositoryCategories.categoryId))
      .where(eq(repositoryCategories.repositoryId, ids['pgvector/pgvector']!))
    expect(enCatalogo).toEqual([{ path: 'data/databases/vector', origin: 'AI', confidence: 0.5 }])

    const etiquetas = await getDb()
      .select({ slug: tags.slug, kind: tags.kind })
      .from(repositoryTags)
      .innerJoin(tags, eq(tags.id, repositoryTags.tagId))
      .where(eq(repositoryTags.repositoryId, ids['pgvector/pgvector']!))
    expect(etiquetas.map((t) => t.slug).sort()).toEqual([
      'nearest-neighbor-search',
      'postgres',
      'similarity-search',
      'vector',
    ])
    expect(etiquetas.every((t) => t.kind === 'AI')).toBe(true)

    const uso = await usageOf('pgvector/pgvector')
    expect(uso).toHaveLength(1)
    expect(uso[0]).toMatchObject({
      provider: 'fake',
      model: 'fake-analysis',
      operation: 'ANALYSIS',
      success: true,
      estimatedCost: 0,
      unmappedCategories: ['postgres', 'nearest neighbor search'],
    })
    expect(uso[0]!.inputTokens).toBeGreaterThan(0)
    expect(uso[0]!.outputTokens).toBeGreaterThan(0)
  })

  it('«quantum finance» queda como tag de IA y se cuenta; «vector similarity search» mapea; ninguna categoría nueva', async () => {
    ai = new FakeAIProvider({
      responses: [valida({ categories: ['quantum finance', 'vector similarity search'] })],
    })
    setAIProvider(ai)
    expect((await analizar('antirez/kilo'))?.outcome).toBe('completed')

    const [total] = await getDb().select({ n: count() }).from(categories)
    expect(total!.n).toBe(flattenTaxonomy().length)
    const enCatalogo = await getDb()
      .select({ path: categories.path })
      .from(repositoryCategories)
      .innerJoin(categories, eq(categories.id, repositoryCategories.categoryId))
      .where(eq(repositoryCategories.repositoryId, ids['antirez/kilo']!))
    expect(enCatalogo).toEqual([{ path: 'data/databases/vector' }])
    const etiquetas = await getDb()
      .select({ slug: tags.slug })
      .from(repositoryTags)
      .innerJoin(tags, eq(tags.id, repositoryTags.tagId))
      .where(eq(repositoryTags.repositoryId, ids['antirez/kilo']!))
    expect(etiquetas).toEqual([{ slug: 'quantum-finance' }])
    const [uso] = await usageOf('antirez/kilo')
    expect(uso!.unmappedCategories).toEqual(['quantum finance'])
  })

  it('una salida que se pasa de largo dos veces deja FAILED al primer intento, sin guardar nada inválido, con las dos llamadas en ai_usage', async () => {
    ai = new FakeAIProvider({
      responses: [
        valida({ summary: 'x'.repeat(400), categories: ['vector'] }),
        valida({ mainUseCases: Array(7).fill('caso'), categories: ['vector'] }),
      ],
    })
    setAIProvider(ai)
    expect((await analizar('antirez/kilo'))?.outcome).toBe('failed')

    const [job] = await getDb().select().from(backgroundJobs)
    expect(job).toMatchObject({ status: 'FAILED', attempts: 1 })
    const analysis = await analysisOf('antirez/kilo')
    expect(analysis).toMatchObject({ status: 'FAILED', summary: null, aiAnalyzedAt: null })
    expect(analysis.lastError).toMatch(/no validó dos veces/)
    const relacionadas = await getDb()
      .select()
      .from(repositoryCategories)
      .where(eq(repositoryCategories.repositoryId, ids['antirez/kilo']!))
    expect(relacionadas).toHaveLength(0)
    const uso = await usageOf('antirez/kilo')
    expect(uso.map((u) => u.success)).toEqual([false, false])
  })

  it('proveedor caído: vuelve a la cola con backoff y, al agotar intentos, FAILED con last_error; cada llamada cuenta', async () => {
    const caida = () => new AIProviderCallError('OpenRouter respondió 503', { retryable: true })
    ai = new FakeAIProvider({ responses: [caida(), caida(), caida()] })
    setAIProvider(ai)

    expect((await analizar('antirez/kilo'))?.outcome).toBe('requeued')
    expect((await analysisOf('antirez/kilo')).status).toBe('PENDING')
    const [enCola] = await getDb().select().from(backgroundJobs)
    expect(enCola!.runAfter.getTime()).toBeGreaterThan(Date.now() + 20_000)

    for (const esperado of ['requeued', 'failed']) {
      await getDb()
        .update(backgroundJobs)
        .set({ runAfter: new Date(0) })
      expect((await processNextJob())?.outcome).toBe(esperado)
    }
    const analysis = await analysisOf('antirez/kilo')
    expect(analysis.status).toBe('FAILED')
    expect(analysis.lastError).toMatch(/503/)
    expect((await usageOf('antirez/kilo')).map((u) => u.success)).toEqual([false, false, false])
  })

  it('con la IA desactivada, DISABLED sin llamar al proveedor ni registrar coste', async () => {
    Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'false' })
    resetEnvCache()
    try {
      expect((await analizar('pgvector/pgvector'))?.outcome).toBe('completed')
    } finally {
      Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'true' })
      resetEnvCache()
    }
    expect((await analysisOf('pgvector/pgvector')).status).toBe('DISABLED')
    expect(ai.requests).toHaveLength(0)
    expect(await getDb().select().from(aiUsage)).toHaveLength(0)
  })

  it('repetir el trabajo sobre un análisis vigente no llama; forzado sí, y si falla se conserva el anterior', async () => {
    expect((await analizar('langchain-ai/langgraph'))?.outcome).toBe('completed')
    const primero = await analysisOf('langchain-ai/langgraph')

    expect((await analizar('langchain-ai/langgraph'))?.outcome).toBe('completed')
    expect(ai.requests).toHaveLength(1)
    expect(await usageOf('langchain-ai/langgraph')).toHaveLength(1)

    const forzado = new FakeAIProvider({
      responses: [new AIProviderCallError('OpenRouter respondió 401', { retryable: false })],
    })
    setAIProvider(forzado)
    expect((await analizar('langchain-ai/langgraph', { force: true }))?.outcome).toBe('failed')
    expect(forzado.requests).toHaveLength(1)
    const despues = await analysisOf('langchain-ai/langgraph')
    expect(despues).toMatchObject({ status: 'COMPLETED', summary: primero.summary })
    expect(despues.aiAnalyzedAt).toEqual(primero.aiAnalyzedAt)
    expect(despues.lastError).toMatch(/401/)
    expect((await usageOf('langchain-ai/langgraph')).map((u) => u.success)).toEqual([true, false])
  })

  it('con un AI_PROVIDER desconocido el worker no arranca y dice qué variable corregir', () => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 25_000,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DATABASE_URL: process.env.DATABASE_URL_TEST,
        AI_ANALYSIS_ENABLED: 'true',
        AI_PROVIDER: 'nadie',
        AI_FAKE: '0',
      },
    })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/worker: no arranca\. AI_PROVIDER «nadie» no es un proveedor conocido/)
  })
})
