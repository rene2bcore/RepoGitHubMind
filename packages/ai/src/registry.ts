import type { Env } from '@rgm/shared'
import { DEFAULT_ANALYSIS_MODEL, type ProviderName } from './defaults'
import { FakeAIProvider } from './fake'
import { OpenRouterProvider } from './openrouter'
import type { AIProvider } from './provider'

export type AIEnv = Pick<Env, 'AI_PROVIDER' | 'AI_MODEL_ANALYSIS' | 'AI_API_KEY' | 'AI_FAKE'>

const FACTORIES: Record<ProviderName, (config: { apiKey: string; model: string }) => AIProvider> = {
  openrouter: (config) => new OpenRouterProvider(config),
}

const isKnown = (name: string): name is ProviderName => Object.hasOwn(FACTORIES, name)

/**
 * Elige el proveedor desde el entorno (ADR-0009). Falla al construirse, con
 * un mensaje que dice qué variable corregir, si `AI_PROVIDER` no es un
 * proveedor conocido o si falta la clave: el worker no arranca en vez de
 * fallar en silencio en la primera llamada (specs/ai · «Proveedor
 * desconocido»). Con `AI_FAKE=1` usa el falso, pero `AI_PROVIDER` se valida
 * igual: una errata no espera a que alguien quite el falso.
 *
 * Los embeddings (`AI_EMBEDDING_PROVIDER`, `AI_MODEL_EMBEDDING`) se añaden
 * aquí con H5.
 */
export class AIProviderRegistry {
  private constructor(private readonly analysisProvider: AIProvider) {}

  static fromEnv(env: AIEnv): AIProviderRegistry {
    const name = env.AI_PROVIDER
    if (!isKnown(name)) {
      throw new Error(
        `AI_PROVIDER «${name}» no es un proveedor conocido. Valores válidos: ${Object.keys(FACTORIES).join(', ')}`,
      )
    }
    if (env.AI_FAKE) return new AIProviderRegistry(new FakeAIProvider())
    if (!env.AI_API_KEY) {
      throw new Error(
        `Falta AI_API_KEY para el proveedor ${name}. Sin clave, usa AI_ANALYSIS_ENABLED=false o AI_FAKE=1`,
      )
    }
    const model = env.AI_MODEL_ANALYSIS || DEFAULT_ANALYSIS_MODEL[name]
    return new AIProviderRegistry(FACTORIES[name]({ apiKey: env.AI_API_KEY, model }))
  }

  analysis(): AIProvider {
    return this.analysisProvider
  }
}
