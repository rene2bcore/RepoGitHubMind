import type { Env } from '@rgm/shared'
import { DEFAULT_ANALYSIS_MODEL, DEFAULT_EMBEDDING_MODEL, type ProviderName } from './defaults'
import {
  FakeEmbeddingProvider,
  OpenRouterEmbeddingProvider,
  type EmbeddingProvider,
} from './embeddings'
import { FakeAIProvider } from './fake'
import { OpenRouterProvider } from './openrouter'
import type { AIProvider } from './provider'

export type AIEnv = Pick<
  Env,
  | 'AI_PROVIDER'
  | 'AI_MODEL_ANALYSIS'
  | 'AI_EMBEDDING_PROVIDER'
  | 'AI_MODEL_EMBEDDING'
  | 'AI_API_KEY'
  | 'AI_FAKE'
>

type Config = { apiKey: string; model: string }

const FACTORIES: Record<
  ProviderName,
  { analysis: (config: Config) => AIProvider; embedding: (config: Config) => EmbeddingProvider }
> = {
  openrouter: {
    analysis: (config) => new OpenRouterProvider(config),
    embedding: (config) => new OpenRouterEmbeddingProvider(config),
  },
}

const isKnown = (name: string): name is ProviderName => Object.hasOwn(FACTORIES, name)

function knownProvider(variable: string, name: string): ProviderName {
  if (!isKnown(name)) {
    throw new Error(
      `${variable} «${name}» no es un proveedor conocido. Valores válidos: ${Object.keys(FACTORIES).join(', ')}`,
    )
  }
  return name
}

/**
 * Elige los proveedores de análisis y de embeddings desde el entorno
 * (ADR-0009). Falla al construirse, con un mensaje que dice qué variable
 * corregir, si `AI_PROVIDER` o `AI_EMBEDDING_PROVIDER` no son proveedores
 * conocidos o si falta la clave: el worker no arranca en vez de fallar en
 * silencio en la primera llamada (specs/ai · «Proveedor desconocido»). Con
 * `AI_FAKE=1` usa los falsos, pero los nombres se validan igual: una errata
 * no espera a que alguien quite el falso. Los dos comparten `AI_API_KEY`.
 */
export class AIProviderRegistry {
  private constructor(
    private readonly analysisProvider: AIProvider,
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  static fromEnv(env: AIEnv): AIProviderRegistry {
    const analysis = knownProvider('AI_PROVIDER', env.AI_PROVIDER)
    const embedding = knownProvider('AI_EMBEDDING_PROVIDER', env.AI_EMBEDDING_PROVIDER)
    if (env.AI_FAKE)
      return new AIProviderRegistry(new FakeAIProvider(), new FakeEmbeddingProvider())
    if (!env.AI_API_KEY) {
      throw new Error(
        `Falta AI_API_KEY para el proveedor ${analysis}. Sin clave, usa AI_ANALYSIS_ENABLED=false o AI_FAKE=1`,
      )
    }
    return new AIProviderRegistry(
      FACTORIES[analysis].analysis({
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL_ANALYSIS || DEFAULT_ANALYSIS_MODEL[analysis],
      }),
      FACTORIES[embedding].embedding({
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL_EMBEDDING || DEFAULT_EMBEDDING_MODEL[embedding],
      }),
    )
  }

  analysis(): AIProvider {
    return this.analysisProvider
  }

  embedding(): EmbeddingProvider {
    return this.embeddingProvider
  }
}
