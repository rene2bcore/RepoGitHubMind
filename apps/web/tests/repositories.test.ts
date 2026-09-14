import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { backgroundJobs, closeDb, getDb, repositories, userRepositories } from '@rgm/db'
import { FakeGitHubProvider, setGitHubProvider } from '@rgm/github'
import { resetEnvCache } from '@rgm/shared'
import { GET as list, POST as save } from '@/app/api/v1/repositories/route'
import { configureRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { cuentaConSesion, jsonRequest, limpiarBase } from './helpers'

/**
 * specs/repositories · «Una URL en cualquier variante», «Un repositorio
 * existe una sola vez», «Metadata de GitHub al guardar», «Guardar responde
 * antes que la IA», «Las operaciones exigen sesión». specs/library ·
 * «Biblioteca vacía», «Lo mío no lo ve nadie» (la parte que H2 ya decide).
 *
 * GitHub es el proveedor falso: cuenta las llamadas, y responde 404 y 429
 * para los repositorios que la spec necesita.
 */
describe('repositories', () => {
  let github: FakeGitHubProvider

  beforeAll(async () => {
    await limpiarBase()
    configureRateLimit({ max: 1000, windowMs: 60_000 })
  })
  beforeEach(() => {
    resetRateLimit()
    github = new FakeGitHubProvider()
    setGitHubProvider(github)
  })
  afterAll(async () => {
    setGitHubProvider(null)
    await closeDb()
  })

  const guardar = (cookie: string, url: string, source?: string) =>
    save(jsonRequest('/api/v1/repositories', { method: 'POST', body: { url, source }, cookie }), {})
  const listar = (cookie: string, qs = '') =>
    list(jsonRequest(`/api/v1/repositories${qs}`, { cookie }), {})

  describe('Una URL en cualquier variante', () => {
    it('variantes con mayúsculas, .git, query y barra final terminan en el mismo repositorio', async () => {
      const ada = await cuentaConSesion('ada')
      const primera = await guardar(ada.cookie, 'https://github.com/PGvector/pgvector.git?x=1')
      expect(primera.status).toBe(201)
      const segunda = await guardar(ada.cookie, 'github.com/pgvector/pgvector/')
      expect(segunda.status).toBe(200)

      const a = (await primera.json()) as { data: { id: string; repository: { fullName: string } } }
      const b = (await segunda.json()) as { data: { id: string } }
      expect(a.data.repository.fullName).toBe('pgvector/pgvector')
      expect(b.data.id).toBe(a.data.id)
      expect(github.calls).toEqual(['pgvector/pgvector'])
      const filas = await getDb().select().from(repositories)
      expect(filas).toHaveLength(1)
    })

    it('una URL que no es de GitHub, o sin owner/repo, es 422 sobre url y no crea nada', async () => {
      const ada = await cuentaConSesion('ada')
      for (const url of [
        'https://gitlab.com/owner/repo',
        'https://github.com/solo-owner',
        'hola',
      ]) {
        const res = await guardar(ada.cookie, url)
        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
          errors: [expect.objectContaining({ field: 'url', rule: 'githubUrl' })],
        })
      }
      expect(github.calls).toEqual([])
    })
  })

  describe('Un repositorio existe una sola vez', () => {
    it('la segunda cuenta que guarda lo mismo no vuelve a pedirlo a GitHub y solo crea su relación', async () => {
      const ada = await cuentaConSesion('ada')
      const grace = await cuentaConSesion('grace')
      expect((await guardar(ada.cookie, 'https://github.com/langchain-ai/langgraph')).status).toBe(
        201,
      )
      const res = await guardar(grace.cookie, 'https://github.com/langchain-ai/langgraph')
      expect(res.status).toBe(201)
      expect(github.calls).toEqual(['langchain-ai/langgraph'])

      const repos = await getDb()
        .select()
        .from(repositories)
        .where(eq(repositories.fullName, 'langchain-ai/langgraph'))
      expect(repos).toHaveLength(1)
      const relaciones = await getDb()
        .select()
        .from(userRepositories)
        .where(eq(userRepositories.repositoryId, repos[0]!.id))
      expect(relaciones.map((r) => r.userId).sort()).toEqual([ada.id, grace.id].sort())
    })

    it('volver a guardar lo que ya tengo responde 200 con la relación existente, sin duplicar', async () => {
      const ada = await cuentaConSesion('ada')
      const primera = (await (
        await guardar(ada.cookie, 'https://github.com/antirez/kilo')
      ).json()) as {
        data: { id: string }
      }
      const res = await guardar(ada.cookie, 'https://github.com/antirez/kilo')
      expect(res.status).toBe(200)
      const body = (await res.json()) as { data: { id: string } }
      expect(body.data.id).toBe(primera.data.id)
      const relaciones = await getDb()
        .select()
        .from(userRepositories)
        .where(eq(userRepositories.userId, ada.id))
      expect(relaciones.filter((r) => r.repositoryId)).toHaveLength(1)
    })
  })

  describe('Metadata de GitHub al guardar', () => {
    it('la respuesta trae la metadata, las fechas separadas y el análisis; nunca el token', async () => {
      const ada = await cuentaConSesion('ada')
      const res = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector', 'whatsapp')
      expect(res.status).toBe(201)
      const texto = await res.text()
      expect(texto).not.toMatch(/ghp_|github_pat_|Bearer/)
      const { data } = JSON.parse(texto) as { data: Record<string, unknown> }
      expect(data.repository).toMatchObject({
        fullName: 'pgvector/pgvector',
        stars: 19400,
        forks: 980,
        license: 'PostgreSQL',
        primaryLanguage: 'C',
        topics: expect.arrayContaining(['postgres', 'vector']),
        githubPushedAt: '2026-09-12T10:04:00.000Z',
        githubCreatedAt: '2021-04-20T13:03:00.000Z',
        latestReleaseAt: '2024-10-30T00:00:00.000Z',
        metadataRefreshedAt: expect.any(String),
      })
      expect(data.personal).toMatchObject({
        status: 'NEW',
        favorite: false,
        rating: null,
        notes: null,
      })
      // El README no viaja en la respuesta de guardar ni en la lista: es del detalle.
      expect(data.repository).not.toHaveProperty('readme')
    })

    it('un repositorio que GitHub no conoce es 404 con la forma del proyecto, y no se crea nada', async () => {
      const ada = await cuentaConSesion('ada')
      const res = await guardar(ada.cookie, 'https://github.com/nadie/no-existe')
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({
        errors: [{ message: 'GitHub no conoce ese repositorio, o es privado' }],
      })
      const filas = await getDb()
        .select()
        .from(repositories)
        .where(eq(repositories.fullName, 'nadie/no-existe'))
      expect(filas).toHaveLength(0)
    })

    it('el límite de GitHub es 429 con la forma del proyecto', async () => {
      const ada = await cuentaConSesion('ada')
      const res = await guardar(ada.cookie, 'https://github.com/limite/limite')
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ errors: [{ message: expect.stringMatching(/GitHub/) }] })
    })
  })

  describe('Guardar responde antes que la IA', () => {
    it('con la IA activa el análisis nace PENDING y queda un trabajo en la cola; con la IA apagada, DISABLED y ningún trabajo', async () => {
      await limpiarBase()
      const ada = await cuentaConSesion('ada')
      // .env.test apaga la IA: DISABLED y sin trabajo.
      const apagada = (await (
        await guardar(ada.cookie, 'https://github.com/antirez/kilo')
      ).json()) as {
        data: { repository: { id: string; analysis: { status: string } } }
      }
      expect(apagada.data.repository.analysis.status).toBe('DISABLED')
      const sinTrabajo = await getDb()
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.repositoryId, apagada.data.repository.id))
      expect(sinTrabajo).toHaveLength(0)

      Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'true' })
      resetEnvCache()
      try {
        const activa = (await (
          await guardar(ada.cookie, 'https://github.com/langchain-ai/langgraph')
        ).json()) as { data: { repository: { id: string; analysis: { status: string } } } }
        expect(activa.data.repository.analysis.status).toBe('PENDING')
        const trabajos = await getDb()
          .select()
          .from(backgroundJobs)
          .where(eq(backgroundJobs.repositoryId, activa.data.repository.id))
        expect(trabajos).toHaveLength(1)
        expect(trabajos[0]).toMatchObject({ type: 'ANALYZE_REPOSITORY', status: 'QUEUED' })
      } finally {
        Object.assign(process.env, { AI_ANALYSIS_ENABLED: 'false' })
        resetEnvCache()
      }
    })
  })

  describe('Las operaciones exigen sesión', () => {
    it('guardar y listar sin sesión responden 401 sin datos, y nada cambia', async () => {
      const antes = (await getDb().select().from(repositories)).length
      const res = await save(
        jsonRequest('/api/v1/repositories', {
          method: 'POST',
          body: { url: 'https://github.com/pgvector/pgvector' },
        }),
        {},
      )
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ errors: [{ message: expect.any(String) }] })
      expect((await getDb().select().from(repositories)).length).toBe(antes)
      expect(github.calls).toEqual([])

      const lista = await list(jsonRequest('/api/v1/repositories'), {})
      expect(lista.status).toBe(401)
    })
  })

  describe('Mi biblioteca', () => {
    it('una cuenta nueva ve 200 con data vacío y meta.total 0', async () => {
      const nueva = await cuentaConSesion('nueva')
      const res = await listar(nueva.cookie)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ data: [], meta: { total: 0, page: 1, pageSize: 24 } })
    })

    it('cada cuenta ve solo lo suyo, y un orden fuera del dominio es 422 sobre sort', async () => {
      const ada = await cuentaConSesion('ada')
      const grace = await cuentaConSesion('grace')
      await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      await guardar(ada.cookie, 'https://github.com/antirez/kilo')
      await guardar(grace.cookie, 'https://github.com/pgvector/pgvector')

      const deAda = (await (await listar(ada.cookie, '?sort=stars')).json()) as {
        data: { repository: { fullName: string } }[]
        meta: { total: number }
      }
      expect(deAda.meta.total).toBe(2)
      expect(deAda.data.map((x) => x.repository.fullName)).toEqual([
        'pgvector/pgvector',
        'antirez/kilo',
      ])

      const deGrace = (await (await listar(grace.cookie)).json()) as {
        data: { repository: { fullName: string } }[]
        meta: { total: number }
      }
      expect(deGrace.meta.total).toBe(1)
      expect(deGrace.data[0]?.repository.fullName).toBe('pgvector/pgvector')

      const color = await listar(ada.cookie, '?sort=color')
      expect(color.status).toBe(422)
      expect(await color.json()).toEqual({ errors: [expect.objectContaining({ field: 'sort' })] })

      const filtrado = (await (await listar(ada.cookie, '?language=c&minStars=10000')).json()) as {
        meta: { total: number }
      }
      expect(filtrado.meta.total).toBe(1)
    })

    it('un filtro que no existe todavía, como category, es 422 y no se ignora (H-08)', async () => {
      const ada = await cuentaConSesion('ada')
      await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      const res = await listar(ada.cookie, '?category=machine-learning')
      expect(res.status).toBe(422)
      expect(JSON.stringify(await res.json())).toContain('category')
    })
  })
})
