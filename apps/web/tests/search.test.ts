import { and, eq, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  AIProviderCallError,
  FakeAIProvider,
  FakeEmbeddingProvider,
  setAIProvider,
  setEmbeddingProvider,
} from '@rgm/ai'
import { aiUsage, closeDb, getDb, repositories } from '@rgm/db'
import { FakeGitHubProvider, setGitHubProvider } from '@rgm/github'
import { resetEnvCache, type SearchMeta, type SearchResult, type UserRepository } from '@rgm/shared'
import { PATCH as personal } from '@/app/api/v1/repositories/[id]/personal/route'
import { GET as list, POST as save } from '@/app/api/v1/repositories/route'
import { GET as search } from '@/app/api/v1/search/route'
import { configureRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { processNextJob } from '../../worker/src/jobs'
import { cuentaConSesion, jsonRequest, limpiarBase } from './helpers'

/**
 * specs/search por la API, con el worker de verdad y los proveedores falsos:
 * «Búsqueda híbrida» («Palabras que no aparecen», «Sin embedding todavía»,
 * «Consulta vacía»), «Ámbitos y privacidad» con dos cuentas («Buscar en mi
 * biblioteca», «Buscar en el corpus global», «Una nota ajena no se busca»),
 * «Filtros combinables» («Combinación») y el «Por qué» de «Resultado
 * legible». Lo que decide el worker está en apps/worker/tests/embeddings.test.ts.
 */
describe('búsqueda híbrida', () => {
  type Body = {
    data: SearchResult[]
    meta: SearchMeta
    errors?: { field?: string; rule?: string }[]
  }

  const guardar = async (cookie: string, url: string) => {
    const res = await save(
      jsonRequest('/api/v1/repositories', { method: 'POST', body: { url }, cookie }),
      {},
    )
    return ((await res.json()) as { data: UserRepository }).data
  }
  /** Lo que haría el worker: análisis y, al completarse, embedding. */
  const procesarCola = async () => {
    while (await processNextJob());
  }
  const buscar = async (cookie: string | undefined, qs: string) => {
    const res = await search(jsonRequest(`/api/v1/search?${qs}`, { cookie }), {})
    const text = await res.text()
    return { status: res.status, text, body: JSON.parse(text) as Body }
  }
  const nombres = (body: Body) => body.data.map((r) => r.repository.fullName)
  const conIA = (activa: boolean) => {
    Object.assign(process.env, { AI_ANALYSIS_ENABLED: String(activa) })
    resetEnvCache()
  }

  beforeAll(() => configureRateLimit({ max: 1000, windowMs: 60_000 }))
  beforeEach(async () => {
    await limpiarBase()
    resetRateLimit()
    setGitHubProvider(new FakeGitHubProvider())
    setAIProvider(new FakeAIProvider())
    setEmbeddingProvider(new FakeEmbeddingProvider())
    conIA(true)
  })
  afterAll(async () => {
    conIA(false)
    setAIProvider(null)
    setEmbeddingProvider(null)
    setGitHubProvider(null)
    await closeDb()
  })

  it('«vectores similares», sin ninguna palabra en común, encuentra pgvector primero por significado; «vectores en postgres», entre los tres primeros; cada resultado dice por qué', async () => {
    const ada = await cuentaConSesion('ada')
    for (const repo of ['antirez/kilo', 'langchain-ai/langgraph', 'pgvector/pgvector'])
      await guardar(ada.cookie, `https://github.com/${repo}`)
    await procesarCola()

    const semantica = await buscar(ada.cookie, 'q=vectores%20similares')
    expect(semantica.status).toBe(200)
    expect(semantica.body.meta).toEqual({ scope: 'library', mode: 'hybrid', total: 1 })
    expect(semantica.body.data[0]!.match).toEqual({
      fields: [],
      terms: [],
      semantic: true,
      reason: expect.stringMatching(
        /^Se parece por significado a lo que buscas: Resumen de prueba/,
      ),
    })
    expect(nombres(semantica.body)).toEqual(['pgvector/pgvector'])

    const spec = await buscar(ada.cookie, 'q=vectores%20en%20postgres')
    expect(nombres(spec.body).slice(0, 3)).toContain('pgvector/pgvector')
    const pgvector = spec.body.data.find((r) => r.repository.fullName === 'pgvector/pgvector')!
    expect(pgvector.match).toMatchObject({ terms: ['postgres'], semantic: true })
    expect(pgvector.match.fields).toEqual(expect.arrayContaining(['description', 'topics']))
    expect(pgvector.match.reason).toMatch(
      /^Coincide «postgres» en .*la descripción.*, y se parece por significado/,
    )
    // Lo que la pantalla necesita para leer el resultado en una línea.
    expect(pgvector.repository).toMatchObject({
      stars: 19400,
      license: 'PostgreSQL',
      categories: [{ slug: 'vector', name: 'Vector', path: 'data/databases/vector' }],
      analysis: expect.objectContaining({ abandonmentRisk: 'LOW' }),
    })
    for (const r of spec.body.data) expect(r.match.reason.length).toBeGreaterThan(10)
  })

  it('un repositorio recién guardado, sin embedding todavía, aparece por coincidencia léxica; con el proveedor caído o la IA apagada la búsqueda sigue en modo léxico', async () => {
    const ada = await cuentaConSesion('ada')
    await guardar(ada.cookie, 'https://github.com/antirez/kilo')

    const recien = await buscar(ada.cookie, 'q=text%20editor')
    expect(nombres(recien.body)).toEqual(['antirez/kilo'])
    expect(recien.body.data[0]!.match).toEqual({
      fields: ['description'],
      terms: ['text', 'editor'],
      semantic: false,
      reason: 'Coincide «text» y «editor» en la descripción',
    })

    setEmbeddingProvider(
      new FakeEmbeddingProvider({
        responses: [new AIProviderCallError('OpenRouter respondió 503', { retryable: true })],
      }),
    )
    const caido = await buscar(ada.cookie, 'q=kilo')
    expect(caido.status).toBe(200)
    expect(caido.body.meta.mode).toBe('lexical')
    expect(nombres(caido.body)).toEqual(['antirez/kilo'])
    // Cada embedding de consulta cuenta en ai_usage sin repositorio: el que
    // funcionó y el que falló.
    const consultas = await getDb()
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.operation, 'EMBEDDING'), isNull(aiUsage.repositoryId)))
      .orderBy(aiUsage.createdAt)
    expect(consultas.map((u) => [u.success, u.error])).toEqual([
      [true, null],
      [false, 'OpenRouter respondió 503'],
    ])

    conIA(false)
    const apagada = await buscar(ada.cookie, 'q=kilo')
    expect(apagada.body.meta.mode).toBe('lexical')
    expect(nombres(apagada.body)).toEqual(['antirez/kilo'])
  })

  it('en global, la nota, el estado y el rating de Ada no salen ni se buscan para Grace; en library cada una ve solo lo suyo', async () => {
    const ada = await cuentaConSesion('ada')
    const grace = await cuentaConSesion('grace')
    const deAda = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
    await personal(
      jsonRequest(`/api/v1/repositories/${deAda.id}/personal`, {
        method: 'PATCH',
        cookie: ada.cookie,
        body: { notes: 'probar para el proyecto Zeta', status: 'USING', rating: 5, favorite: true },
      }),
      { params: Promise.resolve({ id: deAda.id }) },
    )
    const deGrace = await guardar(grace.cookie, 'https://github.com/langchain-ai/langgraph')
    await procesarCola()

    // Una nota ajena no se busca.
    const zeta = await buscar(grace.cookie, 'q=Zeta&scope=global')
    expect(zeta.status).toBe(200)
    expect(zeta.body.data).toEqual([])

    // El corpus global trae el repositorio de Ada sin nada de Ada.
    const global = await buscar(grace.cookie, 'q=postgres%20langgraph&scope=global')
    expect(nombres(global.body).sort()).toEqual(['langchain-ai/langgraph', 'pgvector/pgvector'])
    const pgvector = global.body.data.find((r) => r.repository.fullName === 'pgvector/pgvector')!
    expect(pgvector.id).toBeNull()
    expect(pgvector.personal).toBeNull()
    for (const rastro of ['Zeta', 'USING', ada.id, ada.email, deAda.id]) {
      expect(global.text).not.toContain(rastro)
    }
    // Lo mío sí, aunque busque en global.
    const langgraph = global.body.data.find((r) => r.repository.fullName !== 'pgvector/pgvector')!
    expect(langgraph.id).toBe(deGrace.id)
    expect(langgraph.personal).toMatchObject({ status: 'NEW', notes: null })

    // En library, cada una solo lo suyo.
    expect((await buscar(grace.cookie, 'q=postgres')).body.data).toEqual([])
    const deLaBiblioteca = await buscar(ada.cookie, 'q=postgres')
    expect(nombres(deLaBiblioteca.body)).toEqual(['pgvector/pgvector'])
    expect(deLaBiblioteca.body.data[0]).toMatchObject({
      id: deAda.id,
      personal: {
        status: 'USING',
        rating: 5,
        favorite: true,
        notes: 'probar para el proyecto Zeta',
      },
    })
  })

  it('los filtros se combinan con la consulta: licencias en OR, estrellas mínimas, lenguaje, categoría, estado y favorito; lo personal en global es 422', async () => {
    const ada = await cuentaConSesion('ada')
    for (const repo of ['antirez/kilo', 'langchain-ai/langgraph', 'pgvector/pgvector'])
      await guardar(ada.cookie, `https://github.com/${repo}`)
    await procesarCola()
    // Un segundo MIT por debajo de mil estrellas, para que el filtro combinado tenga qué quitar.
    await getDb()
      .update(repositories)
      .set({ license: 'MIT', stars: 800 })
      .where(eq(repositories.fullName, 'antirez/kilo'))

    const q = 'q=resumen%20prueba'
    expect(nombres((await buscar(ada.cookie, q)).body).sort()).toEqual([
      'antirez/kilo',
      'langchain-ai/langgraph',
      'pgvector/pgvector',
    ])
    const combinados = await buscar(ada.cookie, `${q}&license=MIT,Apache-2.0&minStars=1000`)
    expect(nombres(combinados.body)).toEqual(['langchain-ai/langgraph'])
    expect(nombres((await buscar(ada.cookie, `${q}&license=mit,Apache-2.0`)).body).sort()).toEqual([
      'antirez/kilo',
      'langchain-ai/langgraph',
    ])
    expect(nombres((await buscar(ada.cookie, `${q}&license=MIT&language=C`)).body)).toEqual([
      'antirez/kilo',
    ])
    expect(
      nombres((await buscar(ada.cookie, `${q}&category=artificial-intelligence`)).body),
    ).toEqual(['langchain-ai/langgraph'])
    expect(
      nombres(
        (await buscar(ada.cookie, `${q}&scope=global&category=databases&minStars=1000`)).body,
      ),
    ).toEqual(['pgvector/pgvector'])
    expect((await buscar(ada.cookie, `${q}&status=USING`)).body.data).toEqual([])
    expect(nombres((await buscar(ada.cookie, `${q}&status=NEW&favorite=false`)).body)).toHaveLength(
      3,
    )

    for (const [qs, field] of [
      [`${q}&scope=global&status=NEW`, 'status'],
      [`${q}&scope=global&favorite=true`, 'favorite'],
      [`${q}&category=quantum-finance`, 'category'],
      [`${q}&minStars=muchas`, 'minStars'],
    ] as const) {
      const res = await buscar(ada.cookie, qs)
      expect(res.status).toBe(422)
      expect(res.body.errors).toEqual([expect.objectContaining({ field })])
    }
  })

  it('una consulta de un carácter, un parámetro desconocido o repetido son 422 sobre ese campo; sin sesión, 401', async () => {
    const ada = await cuentaConSesion('ada')
    for (const [qs, field, rule] of [
      ['q=a', 'q', 'too_small'],
      ['q=%20a%20', 'q', 'too_small'],
      ['q=postgres&orden=estrellas', '_', 'unrecognized_keys'],
      ['q=postgres&license=MIT&license=Apache-2.0', 'license', 'repeated'],
      ['q=postgres&limit=0', 'limit', 'too_small'],
    ] as const) {
      const res = await buscar(ada.cookie, qs)
      expect(res.status, qs).toBe(422)
      expect(res.body.errors, qs).toEqual([expect.objectContaining({ field, rule })])
    }
    const lista = await list(
      jsonRequest('/api/v1/repositories?status=NEW&status=USING', { cookie: ada.cookie }),
      {},
    )
    expect(lista.status).toBe(422)

    const sinSesion = await buscar(undefined, 'q=postgres')
    expect(sinSesion.status).toBe(401)
    expect(sinSesion.body).toEqual({ errors: [{ message: 'Hace falta iniciar sesión' }] })
  })
})
