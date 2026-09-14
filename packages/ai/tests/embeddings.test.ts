import { describe, expect, it } from 'vitest'
import {
  FakeEmbeddingProvider,
  OpenRouterEmbeddingProvider,
  fakeEmbedding,
} from '../src/embeddings'
import { AIProviderCallError } from '../src/errors'

/**
 * specs/search · «Búsqueda híbrida» y «Qué se vectoriza», del lado del
 * proveedor (PA-3). Sin red ni clave real: un `fetch` grabado con la forma de
 * `POST /api/v1/embeddings` de OpenRouter, que apunta qué se pidió.
 */
const KEY = 'sk-or-v1-clave-de-prueba'

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> }

function fakeFetch(responses: (() => Response)[]) {
  const calls: Call[] = []
  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers as Record<string, string>) ?? {},
      body: JSON.parse(String(init?.body)),
    })
    const next = responses.shift()
    if (!next) throw new Error('la prueba no esperaba otra llamada')
    return next()
  }) as typeof fetch
  return { fetchImpl, calls }
}

const vector = (dimensions: number, value = 0.01) => new Array<number>(dimensions).fill(value)

const respuesta = (embeddings: number[][], usage = { prompt_tokens: 7, cost: 1.4e-7 }) => ({
  object: 'list',
  model: 'openai/text-embedding-3-small',
  // Desordenados a propósito: el orden lo da `index`.
  data: embeddings.map((embedding, index) => ({ object: 'embedding', index, embedding })).reverse(),
  usage: { ...usage, total_tokens: usage.prompt_tokens },
})

const provider = (fetchImpl: typeof fetch) =>
  new OpenRouterEmbeddingProvider({ apiKey: KEY, model: 'modelo/embedding', fetchImpl })

const fallo = <E>(promise: Promise<unknown>): Promise<E> =>
  promise.then(
    () => {
      throw new Error('se esperaba un error')
    },
    (error: unknown) => error as E,
  )

describe('OpenRouterEmbeddingProvider', () => {
  it('pide los embeddings con la clave en la cabecera y el modelo configurado, y devuelve los vectores en orden con su coste', async () => {
    const primero = vector(1536, 0.1)
    const segundo = vector(1536, 0.2)
    const { fetchImpl, calls } = fakeFetch([() => Response.json(respuesta([primero, segundo]))])
    const outcome = await provider(fetchImpl).embed(['uno', 'dos'])

    expect(outcome.vectors).toEqual([primero, segundo])
    expect(outcome.call).toEqual({
      inputTokens: 7,
      outputTokens: 0,
      estimatedCost: 1.4e-7,
      success: true,
      error: null,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://openrouter.ai/api/v1/embeddings')
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(calls[0]!.body).toEqual({
      model: 'modelo/embedding',
      input: ['uno', 'dos'],
      encoding_format: 'float',
    })
    expect(JSON.stringify(calls[0]!.body)).not.toContain(KEY)
  })

  it('una dimensión distinta de 1536 se rechaza sin reintento y la llamada queda para ai_usage', async () => {
    const { fetchImpl } = fakeFetch([() => Response.json(respuesta([vector(768)]))])
    const error = await fallo<AIProviderCallError>(provider(fetchImpl).embed(['uno']))

    expect(error).toBeInstanceOf(AIProviderCallError)
    expect(error.retryable).toBe(false)
    expect(error.message).toMatch(/768 dimensiones y el esquema espera 1536/)
    expect(error.calls).toEqual([
      expect.objectContaining({ success: false, inputTokens: 7, estimatedCost: 1.4e-7 }),
    ])
  })

  it('un 429 y un 503 son reintentables; un 401 no y no lleva la clave; sin red, reintentable', async () => {
    const limite = await fallo<AIProviderCallError>(
      provider(
        fakeFetch([
          () =>
            Response.json(
              { error: { code: 429, message: 'Rate limit exceeded' } },
              { status: 429, headers: { 'retry-after': '20' } },
            ),
        ]).fetchImpl,
      ).embed(['uno']),
    )
    expect(limite.retryable).toBe(true)
    expect(limite.retryAfter).toBeInstanceOf(Date)

    const caido = await fallo<AIProviderCallError>(
      provider(fakeFetch([() => new Response('', { status: 503 })]).fetchImpl).embed(['uno']),
    )
    expect(caido.retryable).toBe(true)

    const clave = await fallo<AIProviderCallError>(
      provider(
        fakeFetch([
          () => Response.json({ error: { code: 401, message: 'No auth' } }, { status: 401 }),
        ]).fetchImpl,
      ).embed(['uno']),
    )
    expect(clave.retryable).toBe(false)
    expect(clave.message).not.toContain(KEY)

    const sinRed = await fallo<AIProviderCallError>(
      provider((async () => {
        throw new TypeError('fetch failed')
      }) as typeof fetch).embed(['uno']),
    )
    expect(sinRed.retryable).toBe(true)
  })
})

describe('FakeEmbeddingProvider', () => {
  const coseno = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0)

  it('es determinista, normalizado, de 1536 dimensiones, y acerca palabras que comparten raíz sin compartir la palabra', async () => {
    const fake = new FakeEmbeddingProvider()
    const { vectors } = await fake.embed(['vectores similares', 'vectores similares'])
    expect(vectors[0]).toEqual(vectors[1])
    expect(vectors[0]).toHaveLength(1536)
    expect(Math.hypot(...vectors[0]!)).toBeCloseTo(1, 6)

    const consulta = fakeEmbedding('vectores similares')
    const cercano = fakeEmbedding('Open-source vector similarity search for Postgres')
    const lejano = fakeEmbedding('A text editor in less than 1000 LOC with syntax highlight')
    expect(coseno(consulta, cercano)).toBeGreaterThan(fake.minSimilarity)
    expect(coseno(consulta, lejano)).toBeLessThan(fake.minSimilarity)
    expect(fake.requests).toEqual([['vectores similares', 'vectores similares']])
  })
})
