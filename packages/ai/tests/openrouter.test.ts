import { describe, expect, it } from 'vitest'
import { AIOutputInvalidError, AIProviderCallError } from '../src/errors'
import { OpenRouterProvider } from '../src/openrouter'
import { completion, request, VALID } from './fixtures/openrouter'

/**
 * specs/ai · «Salida estructurada y acotada» («Salida válida», «Salida que se
 * pasa de largo»), «Contexto económico», «Proveedor reemplazable» y «La IA
 * nunca impide guardar» («Proveedor caído»). Sin red y sin clave real: un
 * `fetch` grabado que apunta qué se pidió y responde lo que cada caso necesita.
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

const provider = (fetchImpl: typeof fetch) =>
  new OpenRouterProvider({ apiKey: KEY, model: 'modelo/de-prueba', fetchImpl })

/** El error con el que tiene que acabar la llamada; si no acaba en error, la prueba falla. */
const fallo = <E>(promise: Promise<unknown>): Promise<E> =>
  promise.then(
    () => {
      throw new Error('se esperaba un error')
    },
    (error: unknown) => error as E,
  )

describe('OpenRouterProvider', () => {
  it('pide salida estructurada con la clave en la cabecera, el modelo configurado y solo metadata y README', async () => {
    const { fetchImpl, calls } = fakeFetch([() => Response.json(completion(JSON.stringify(VALID)))])
    const outcome = await provider(fetchImpl).analyzeRepository(request())

    expect(outcome.analysis).toEqual(VALID)
    expect(outcome.calls).toEqual([
      { inputTokens: 1200, outputTokens: 300, estimatedCost: 0.00024, success: true, error: null },
    ])

    expect(calls).toHaveLength(1)
    const [call] = calls
    expect(call!.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(call!.headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(call!.body.model).toBe('modelo/de-prueba')
    expect(call!.body.provider).toEqual({ require_parameters: true })
    const format = call!.body.response_format as {
      type: string
      json_schema: { strict: boolean; schema: { required: string[]; properties: object } }
    }
    expect(format.type).toBe('json_schema')
    expect(format.json_schema.strict).toBe(true)
    expect(format.json_schema.schema.required).toEqual(Object.keys(VALID))
    expect(JSON.stringify(format.json_schema.schema)).not.toContain('maxLength')

    const prompt = JSON.stringify(call!.body.messages)
    expect(prompt).toContain('pgvector/pgvector')
    expect(prompt).toContain('data/databases/vector')
    expect(prompt).toContain('Open-source vector similarity search for Postgres.')
    // La clave viaja solo en la cabecera.
    expect(prompt).not.toContain(KEY)
  })

  it('una salida que se pasa de largo se reintenta una vez pidiendo corrección, y la corregida se acepta', async () => {
    const larga = { ...VALID, summary: 'x'.repeat(400) }
    const { fetchImpl, calls } = fakeFetch([
      () => Response.json(completion(JSON.stringify(larga))),
      () => Response.json(completion(`\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\``)),
    ])
    const outcome = await provider(fetchImpl).analyzeRepository(request())

    expect(outcome.analysis.summary).toBe(VALID.summary)
    expect(outcome.calls.map((c) => c.success)).toEqual([false, true])
    expect(outcome.calls[0]!.error).toMatch(/summary/)
    const segunda = calls[1]!.body.messages as { role: string; content: string }[]
    expect(segunda.at(-2)).toEqual({ role: 'assistant', content: JSON.stringify(larga) })
    expect(segunda.at(-1)!.role).toBe('user')
    expect(segunda.at(-1)!.content).toMatch(/no cumple el esquema[\s\S]*summary/)
  })

  it('dos salidas que no validan (400 caracteres, 7 casos de uso) terminan en AIOutputInvalidError, con las dos llamadas', async () => {
    const { fetchImpl, calls } = fakeFetch([
      () => Response.json(completion(JSON.stringify({ ...VALID, summary: 'x'.repeat(400) }))),
      () =>
        Response.json(
          completion(JSON.stringify({ ...VALID, mainUseCases: Array(7).fill('caso de uso') })),
        ),
    ])
    const invalid = await fallo<AIOutputInvalidError>(
      provider(fetchImpl).analyzeRepository(request()),
    )

    expect(invalid).toBeInstanceOf(AIOutputInvalidError)
    expect(invalid.retryable).toBe(false)
    expect(invalid.issues.join(' ')).toMatch(/mainUseCases/)
    expect(invalid.calls).toHaveLength(2)
    expect(invalid.calls.every((c) => !c.success && c.inputTokens === 1200)).toBe(true)
    expect(calls).toHaveLength(2)
  })

  it('un 429 con retry-after y un 503 son reintentables; un 401 no, y su mensaje no lleva la clave', async () => {
    const antes = Date.now()
    const limite = await fallo<AIProviderCallError>(
      provider(
        fakeFetch([
          () =>
            Response.json(
              { error: { code: 429, message: 'Rate limit exceeded' } },
              { status: 429, headers: { 'retry-after': '30' } },
            ),
        ]).fetchImpl,
      ).analyzeRepository(request()),
    )
    expect(limite).toBeInstanceOf(AIProviderCallError)
    expect(limite.retryable).toBe(true)
    expect(limite.retryAfter!.getTime()).toBeGreaterThanOrEqual(antes + 30_000)
    expect(limite.calls).toEqual([expect.objectContaining({ success: false, inputTokens: 0 })])

    const caido = await fallo<AIProviderCallError>(
      provider(fakeFetch([() => new Response('', { status: 503 })]).fetchImpl).analyzeRepository(
        request(),
      ),
    )
    expect(caido.retryable).toBe(true)
    expect(caido.message).toMatch(/503/)

    const clave = await fallo<AIProviderCallError>(
      provider(
        fakeFetch([
          () =>
            Response.json({ error: { code: 401, message: 'User not found.' } }, { status: 401 }),
        ]).fetchImpl,
      ).analyzeRepository(request()),
    )
    expect(clave).toBeInstanceOf(AIProviderCallError)
    expect(clave.retryable).toBe(false)
    expect(clave.message).toMatch(/401/)
    expect(clave.message).not.toContain(KEY)
  })

  it('sin red o con el proveedor sin responder, el error es reintentable', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    const error = await fallo<AIProviderCallError>(provider(fetchImpl).analyzeRepository(request()))
    expect(error).toBeInstanceOf(AIProviderCallError)
    expect(error.retryable).toBe(true)
  })

  it('un README enorme viaja recortado a AI_MAX_README_CHARS y el análisis se completa igual', async () => {
    const readme = `# pgvector\n\nIntro.\n\n## Motivation\n\n${'bla '.repeat(5000)}\n\n## Installation\n\nmake install\n`
    const { fetchImpl, calls } = fakeFetch([() => Response.json(completion(JSON.stringify(VALID)))])
    const outcome = await provider(fetchImpl).analyzeRepository({
      ...request({ readme }),
      maxReadmeChars: 1000,
    })
    expect(outcome.analysis).toEqual(VALID)
    const user = (calls[0]!.body.messages as { role: string; content: string }[])[1]!.content
    const enviado = user.split('<<<README\n')[1]!.split('\nREADME>>>')[0]!
    expect(enviado.length).toBeLessThanOrEqual(1000)
    expect(enviado).toContain('make install')
    expect(user).toContain('recortado a 1000 caracteres')
  })
})
