import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FakeAIProvider, setAIProvider } from '@rgm/ai'
import {
  aiUsage,
  backgroundJobs,
  claimJob,
  closeDb,
  enqueueJob,
  getDb,
  repositories,
  repositoryAnalyses,
} from '@rgm/db'
import { FakeGitHubProvider, setGitHubProvider } from '@rgm/github'
import { resetEnvCache, type UserRepository, type UserRepositoryDetail } from '@rgm/shared'
import { POST as analyze } from '@/app/api/v1/repositories/[id]/analysis/route'
import { GET as detail } from '@/app/api/v1/repositories/[id]/route'
import { GET as list, POST as save } from '@/app/api/v1/repositories/route'
import { configureRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { listLibraryCategories } from '@/modules/repositories/service'
import { analyzeRepositoryJob } from '../../worker/src/analyze'
import { processNextJob } from '../../worker/src/jobs'
import { cuentaConSesion, jsonRequest, limpiarBase } from './helpers'

/**
 * specs/ai de punta a punta: guardar por la API, el worker de verdad con el
 * proveedor falso, y otra vez la API. «Segunda cuenta», «Repositorio que
 * cambió», «Proveedor caído» (reintentar), «IA desactivada», «Repositorio
 * archivado», «Sin precisión falsa»; specs/library · «Lista con orden y
 * filtros» con la categoría (H-08). Lo que solo decide el worker está en
 * apps/worker/tests/analisis.test.ts.
 */
describe('análisis de IA', () => {
  let ai: FakeAIProvider

  const guardar = async (cookie: string, url: string) => {
    const res = await save(
      jsonRequest('/api/v1/repositories', { method: 'POST', body: { url }, cookie }),
      {},
    )
    return { status: res.status, body: (await res.json()) as { data: UserRepository } }
  }
  const pedir = async (cookie: string | undefined, id: string, body: unknown = {}) => {
    const res = await analyze(
      jsonRequest(`/api/v1/repositories/${id}/analysis`, { method: 'POST', body, cookie }),
      { params: Promise.resolve({ id }) },
    )
    return { status: res.status, body: await res.json() }
  }
  const listar = async (cookie: string, qs = '') => {
    const res = await list(jsonRequest(`/api/v1/repositories${qs}`, { cookie }), {})
    return { status: res.status, body: await res.json() }
  }
  const usos = async () =>
    (await getDb().select().from(aiUsage).where(eq(aiUsage.operation, 'ANALYSIS'))).length
  const enCola = () =>
    getDb()
      .select()
      .from(backgroundJobs)
      .where(
        and(eq(backgroundJobs.status, 'QUEUED'), eq(backgroundJobs.type, 'ANALYZE_REPOSITORY')),
      )
  /**
   * Vacía la cola como el worker y devuelve cómo terminó el análisis, o null si
   * no había ninguno. Completar un análisis encola GENERATE_EMBEDDING (H5), que
   * aquí se procesa y no se mira: lo prueba apps/worker/tests/embeddings.test.ts.
   */
  const analizarCola = async () => {
    let outcome: string | null = null
    for (let r = await processNextJob(); r; r = await processNextJob()) {
      if (r.job.type === 'ANALYZE_REPOSITORY') outcome = r.outcome
    }
    return outcome
  }
  const conIA = (activa: boolean) => {
    Object.assign(process.env, { AI_ANALYSIS_ENABLED: String(activa) })
    resetEnvCache()
  }

  beforeAll(() => configureRateLimit({ max: 1000, windowMs: 60_000 }))
  beforeEach(async () => {
    await limpiarBase()
    resetRateLimit()
    setGitHubProvider(new FakeGitHubProvider())
    ai = new FakeAIProvider()
    setAIProvider(ai)
    conIA(true)
  })
  afterAll(async () => {
    conIA(false)
    setAIProvider(null)
    setGitHubProvider(null)
    await closeDb()
  })

  it('la segunda cuenta ve el análisis al momento y no se registra ninguna fila nueva en ai_usage', async () => {
    const ada = await cuentaConSesion('ada')
    const grace = await cuentaConSesion('grace')
    const deAda = await guardar(ada.cookie, 'https://github.com/langchain-ai/langgraph')
    expect(deAda.body.data.repository.analysis.status).toBe('PENDING')
    expect(await analizarCola()).toBe('completed')
    expect(await usos()).toBe(1)

    const deGrace = await guardar(grace.cookie, 'https://github.com/langchain-ai/langgraph')
    expect(deGrace.status).toBe(201)
    const r = deGrace.body.data.repository
    expect(r.analysis).toMatchObject({
      status: 'COMPLETED',
      summary: expect.stringMatching(/^Resumen de prueba/),
      tags: ['agents', 'llm', 'orchestration'],
    })
    expect(r.categories.map((c) => c.path)).toEqual([
      'artificial-intelligence/agents',
      'artificial-intelligence/llm',
    ])

    expect(await enCola()).toHaveLength(0)
    expect(await analizarCola()).toBeNull()
    expect(await usos()).toBe(1)
    expect(ai.requests).toHaveLength(1)
  })

  it('un repositorio con pushes posteriores al análisis, o caducado, se reencola al guardar y el anterior se ve hasta que termina', async () => {
    const ada = await cuentaConSesion('ada')
    const grace = await cuentaConSesion('grace')
    const { body } = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
    await analizarCola()
    const repositoryId = body.data.repository.id
    const antiguo = new Date('2026-09-01T00:00:00Z')
    await getDb()
      .update(repositoryAnalyses)
      .set({ aiAnalyzedAt: antiguo, summary: 'Resumen anterior' })
      .where(eq(repositoryAnalyses.repositoryId, repositoryId))

    const deGrace = await guardar(grace.cookie, 'https://github.com/pgvector/pgvector')
    expect(deGrace.body.data.repository.analysis).toMatchObject({
      status: 'COMPLETED',
      summary: 'Resumen anterior',
    })
    expect(await enCola()).toHaveLength(1)
    expect(await analizarCola()).toBe('completed')
    const [nuevo] = await getDb()
      .select()
      .from(repositoryAnalyses)
      .where(eq(repositoryAnalyses.repositoryId, repositoryId))
    expect(nuevo!.aiAnalyzedAt!.getTime()).toBeGreaterThan(antiguo.getTime())
    expect(nuevo!.summary).toMatch(/^Resumen de prueba/)
    expect(await usos()).toBe(2)

    // Sin cambios y vigente, volver a guardar no encola; caducado, sí.
    await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
    expect(await enCola()).toHaveLength(0)
    await getDb()
      .update(repositoryAnalyses)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(repositoryAnalyses.repositoryId, repositoryId))
    expect((await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')).status).toBe(200)
    expect(await enCola()).toHaveLength(1)
  })

  it('un análisis que falló deja el repositorio en la biblioteca y se reintenta: 202 si queda en camino, 200 si no hacía falta, force lo rehace', async () => {
    ai = new FakeAIProvider({ responses: ['no es json', '{"summary": 1}'] })
    setAIProvider(ai)
    const ada = await cuentaConSesion('ada')
    const { body } = await guardar(ada.cookie, 'https://github.com/antirez/kilo')
    const id = body.data.id
    expect(await analizarCola()).toBe('failed')

    const biblioteca = await listar(ada.cookie)
    expect(biblioteca.status).toBe(200)
    expect(biblioteca.body.data).toEqual([
      expect.objectContaining({
        id,
        repository: expect.objectContaining({
          analysis: expect.objectContaining({ status: 'FAILED' }),
        }),
      }),
    ])

    const reintento = await pedir(ada.cookie, id)
    expect(reintento.status).toBe(202)
    expect(reintento.body.data.repository.analysis.status).toBe('PENDING')
    expect(await analizarCola()).toBe('completed')

    const vigente = await pedir(ada.cookie, id)
    expect(vigente.status).toBe(200)
    expect(vigente.body.data.repository.analysis.status).toBe('COMPLETED')
    expect(await enCola()).toHaveLength(0)

    const forzado = await pedir(ada.cookie, id, { force: true })
    expect(forzado.status).toBe(202)
    const [trabajo] = await enCola()
    expect(trabajo!.payload).toEqual({ force: true })
    expect(await analizarCola()).toBe('completed')
    expect(ai.requests).toHaveLength(3)
    expect(await usos()).toBe(4)
  })

  it('forzar mientras un trabajo ya está en curso no se pierde: ese trabajo rehace el análisis', async () => {
    const ada = await cuentaConSesion('ada')
    const { body } = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
    expect(await analizarCola()).toBe('completed')
    const repositoryId = body.data.repository.id

    // Un trabajo sobre el análisis vigente, tomado por el worker y todavía sin decidir.
    await enqueueJob('ANALYZE_REPOSITORY', repositoryId)
    const enCurso = await claimJob()
    expect(enCurso?.status).toBe('PROCESSING')

    const forzado = await pedir(ada.cookie, body.data.id, { force: true })
    expect(forzado.status).toBe(202)

    expect(await analyzeRepositoryJob(enCurso!)).toBe('analyzed')
    expect(ai.requests).toHaveLength(2)
  })

  it('pedir el análisis exige sesión, valida antes de resolver, y el id de otra cuenta es 404', async () => {
    const ada = await cuentaConSesion('ada')
    const grace = await cuentaConSesion('grace')
    const { body } = await guardar(ada.cookie, 'https://github.com/antirez/kilo')
    const id = body.data.id

    expect((await pedir(undefined, id)).status).toBe(401)
    expect((await pedir(grace.cookie, id)).status).toBe(404)
    const invalido = await pedir(ada.cookie, '00000000-0000-4000-8000-000000000000', {
      force: 'si',
    })
    expect(invalido.status).toBe(422)
    expect(invalido.body).toEqual({ errors: [expect.objectContaining({ field: 'force' })] })
    expect(ai.requests).toHaveLength(0)
  })

  it('con la IA desactivada, guardar funciona, el análisis es DISABLED, reintentar responde 200 sin encolar y ai_usage no gana filas', async () => {
    conIA(false)
    const ada = await cuentaConSesion('ada')
    const { status, body } = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
    expect(status).toBe(201)
    expect(body.data.repository.analysis.status).toBe('DISABLED')
    const reintento = await pedir(ada.cookie, body.data.id)
    expect(reintento.status).toBe(200)
    expect(reintento.body.data.repository.analysis.status).toBe('DISABLED')
    expect(await enCola()).toHaveLength(0)
    expect(await usos()).toBe(0)
  })

  it('el filtro por categoría toma la rama entera, se combina con los demás, y una categoría fuera del catálogo es 422', async () => {
    const ada = await cuentaConSesion('ada')
    const grace = await cuentaConSesion('grace')
    await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
    await guardar(ada.cookie, 'https://github.com/langchain-ai/langgraph')
    await guardar(ada.cookie, 'https://github.com/antirez/kilo')
    await analizarCola()

    const nombres = async (cookie: string, qs: string) =>
      ((await listar(cookie, qs)).body.data as UserRepository[]).map((i) => i.repository.fullName)
    expect(await nombres(ada.cookie, '?category=vector')).toEqual(['pgvector/pgvector'])
    expect(await nombres(ada.cookie, '?category=data')).toEqual(['pgvector/pgvector'])
    expect(await nombres(ada.cookie, '?category=artificial-intelligence')).toEqual([
      'langchain-ai/langgraph',
    ])
    expect(await nombres(ada.cookie, '?category=agents&language=python')).toEqual([
      'langchain-ai/langgraph',
    ])
    expect(await nombres(ada.cookie, '?category=agents&language=c')).toEqual([])
    expect(await nombres(grace.cookie, '?category=vector')).toEqual([])

    for (const categoria of ['quantum-finance', 'No Es Slug']) {
      const res = await listar(ada.cookie, `?category=${encodeURIComponent(categoria)}`)
      expect(res.status).toBe(422)
      expect(res.body).toEqual({
        errors: [expect.objectContaining({ field: 'category' })],
      })
    }

    expect((await listLibraryCategories(ada.id)).map((c) => c.path)).toEqual([
      'artificial-intelligence',
      'artificial-intelligence/agents',
      'artificial-intelligence/llm',
      'data',
      'data/databases',
      'data/databases/vector',
    ])
    expect(await listLibraryCategories(grace.id)).toEqual([])
  })

  it('el detalle trae el análisis completo, y un archivado es HIGH heurístico aunque la IA diga LOW, sin confianza ni decimales', async () => {
    const valida = {
      summary: 'Editor de texto mínimo.',
      purpose: 'Enseñar a escribir un editor.',
      mainUseCases: ['Aprender C'],
      categories: ['cli'],
      tags: ['editor'],
      installationSummary: 'make',
      deploymentType: ['binario'],
      frameworks: [],
      maturity: 'estable',
      advantages: ['Pequeño'],
      limitations: ['Sin plugins'],
      targetUsers: ['estudiantes'],
      activityAssessment: 'Sin actividad reciente.',
      abandonmentRisk: 'LOW',
      aiConfidence: 0.9,
    }
    ai = new FakeAIProvider({ responses: [JSON.stringify(valida)] })
    setAIProvider(ai)
    const ada = await cuentaConSesion('ada')
    const { body } = await guardar(ada.cookie, 'https://github.com/antirez/kilo')
    await getDb()
      .update(repositories)
      .set({ archived: true })
      .where(and(eq(repositories.id, body.data.repository.id)))
    await analizarCola()

    const res = await detail(
      jsonRequest(`/api/v1/repositories/${body.data.id}`, { cookie: ada.cookie }),
      {
        params: Promise.resolve({ id: body.data.id }),
      },
    )
    const texto = await res.text()
    const { data } = JSON.parse(texto) as { data: UserRepositoryDetail }
    expect(data.repository.analysis).toMatchObject({
      status: 'COMPLETED',
      purpose: 'Enseñar a escribir un editor.',
      installationSummary: 'make',
      deploymentType: ['binario'],
      maturity: 'estable',
      advantages: ['Pequeño'],
      limitations: ['Sin plugins'],
      targetUsers: ['estudiantes'],
      activityAssessment: 'Sin actividad reciente.',
      tags: ['editor'],
      abandonmentRisk: 'HIGH',
      abandonmentRiskSource: 'HEURISTIC',
    })
    expect(data.repository.categories).toEqual([
      { slug: 'cli', name: 'CLI', path: 'developer-tools/cli' },
    ])
    // Como valor JSON, no como texto suelto: «50.912Z» en un timestamp contiene «0.9».
    expect(texto).not.toMatch(/"aiConfidence"|:0\.9[,}]/)
  })
})
