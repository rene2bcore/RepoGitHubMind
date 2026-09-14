import { DEFAULT_MIN_SIMILARITY, EMBEDDING_DIMENSIONS } from './defaults'
import { AIProviderCallError } from './errors'
import { postOpenRouter, type OpenRouterConnection } from './openrouter'
import type { AICallUsage } from './provider'

const EMBEDDINGS_ENDPOINT = 'https://openrouter.ai/api/v1/embeddings'

/** Un vector por texto, en el mismo orden, y la llamada para `ai_usage`. */
export type EmbeddingOutcome = { vectors: number[][]; call: AICallUsage }

/**
 * El único punto por el que el sistema pide embeddings (ADR-0009, PA-3). Cada
 * implementación declara su nombre y su modelo, que es lo que se guarda en
 * `repository_embeddings.model` y en `ai_usage`; solo se comparan vectores
 * del mismo modelo. `minSimilarity` es la similitud de coseno por debajo de
 * la cual un repositorio no entra en la búsqueda por su parte semántica, y
 * depende del modelo.
 *
 * Errores: `AIProviderCallError` (red, límite, 5xx, clave; o una respuesta con
 * otra dimensión u otro número de vectores, no reintentable), con la llamada
 * hecha para registrarla aunque no haya vectores.
 */
export interface EmbeddingProvider {
  readonly name: string
  readonly model: string
  readonly dimensions: number
  readonly minSimilarity: number
  embed(texts: string[]): Promise<EmbeddingOutcome>
}

type EmbeddingResponse = {
  data?: { embedding?: unknown; index?: number }[]
  usage?: { prompt_tokens?: number; total_tokens?: number; cost?: number }
  error?: { code?: number | string; message?: string }
}

/**
 * `EmbeddingProvider` sobre `POST /api/v1/embeddings` de OpenRouter, en el
 * formato de OpenAI (`{ model, input }` -> `data[i].embedding`). El modelo
 * llega de `AI_MODEL_EMBEDDING` o de `defaults.ts`. El coste es el que
 * OpenRouter declara en `usage.cost`. Qué errores se reintentan, en
 * `postOpenRouter`; una dimensión distinta de la del esquema no se reintenta,
 * porque el mismo modelo devolvería lo mismo.
 */
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openrouter'
  readonly model: string
  readonly dimensions = EMBEDDING_DIMENSIONS
  readonly minSimilarity: number

  constructor(
    private readonly options: OpenRouterConnection & { model: string; minSimilarity?: number },
  ) {
    this.model = options.model
    this.minSimilarity = options.minSimilarity ?? DEFAULT_MIN_SIMILARITY.openrouter
  }

  async embed(texts: string[]): Promise<EmbeddingOutcome> {
    const json = await postOpenRouter<EmbeddingResponse>(
      EMBEDDINGS_ENDPOINT,
      { model: this.model, input: texts, encoding_format: 'float' },
      { ...this.options, defaultTimeoutMs: 30_000 },
    )
    const usage = {
      inputTokens: json.usage?.prompt_tokens ?? json.usage?.total_tokens ?? 0,
      outputTokens: 0,
      estimatedCost: typeof json.usage?.cost === 'number' ? json.usage.cost : null,
    }
    const invalid = (message: string) =>
      new AIProviderCallError(message, {
        retryable: false,
        calls: [{ ...usage, success: false, error: message }],
      })

    const data = [...(json.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    if (data.length !== texts.length) {
      throw invalid(`OpenRouter devolvió ${data.length} embeddings para ${texts.length} textos`)
    }
    const vectors = data.map((d) => d.embedding)
    for (const vector of vectors) {
      if (!Array.isArray(vector) || !vector.every((n) => typeof n === 'number' && isFinite(n))) {
        throw invalid('OpenRouter devolvió un embedding que no es una lista de números')
      }
      if (vector.length !== this.dimensions) {
        throw invalid(
          `OpenRouter devolvió un embedding de ${vector.length} dimensiones y el esquema espera ${this.dimensions}`,
        )
      }
    }
    return { vectors: vectors as number[][], call: { ...usage, success: true, error: null } }
  }
}

/**
 * `EmbeddingProvider` sin red, para pruebas y para desarrollar sin clave
 * (`AI_FAKE=1`). Determinista: cada palabra de cuatro o más letras, sin
 * acentos, se parte en trigramas de caracteres que suman en una posición del
 * vector por hash, y el vector se normaliza. Así «vectores» se parece a
 * «vector» sin compartir la palabra, que es lo que una prueba necesita para
 * ver la parte semántica encontrar lo que la léxica no encuentra. No sabe
 * de sinónimos: no es un modelo. Con `responses` lanza, en orden, los errores
 * que se le den; cuenta las llamadas.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly name: string
  readonly model: string
  readonly dimensions: number
  readonly minSimilarity: number
  readonly requests: string[][] = []
  private readonly responses: Error[]

  constructor(
    options: {
      name?: string
      model?: string
      dimensions?: number
      minSimilarity?: number
      responses?: Error[]
    } = {},
  ) {
    this.name = options.name ?? 'fake'
    this.model = options.model ?? 'fake-embedding'
    this.dimensions = options.dimensions ?? EMBEDDING_DIMENSIONS
    this.minSimilarity = options.minSimilarity ?? 0.25
    this.responses = [...(options.responses ?? [])]
  }

  async embed(texts: string[]): Promise<EmbeddingOutcome> {
    this.requests.push(texts)
    const next = this.responses.shift()
    if (next) throw next
    const tokens = texts.reduce((n, t) => n + Math.ceil(t.length / 4), 0)
    return {
      vectors: texts.map((t) => fakeEmbedding(t, this.dimensions)),
      call: { inputTokens: tokens, outputTokens: 0, estimatedCost: 0, success: true, error: null },
    }
  }
}

export function fakeEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0)
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4)
  for (const word of words) {
    const padded = ` ${word} `
    for (let i = 0; i + 3 <= padded.length; i++) {
      vector[fnv1a(padded.slice(i, i + 3)) % dimensions]! += 1
    }
  }
  const norm = Math.hypot(...vector)
  return norm ? vector.map((n) => n / norm) : vector
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
