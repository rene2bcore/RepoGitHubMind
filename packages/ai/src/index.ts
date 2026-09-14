import { readEnv } from '@rgm/shared'
import type { AIProvider } from './provider'
import { AIProviderRegistry } from './registry'

export type {
  AICallUsage,
  AIProvider,
  AnalysisInput,
  AnalysisOutcome,
  AnalysisRequest,
  CatalogCategory,
} from './provider'
export { AIOutputInvalidError, AIProviderCallError } from './errors'
export { ANALYSIS_LIMITS, parseAnalysis, repositoryAnalysisSchema } from './schema'
export type { RepositoryAnalysis } from './schema'
export { AIProviderRegistry, type AIEnv } from './registry'
export { OpenRouterProvider } from './openrouter'
export { FakeAIProvider, fakeAnalysis } from './fake'
export { analysisExpiry, analysisStaleReason, type StaleReason } from './cache'
export { abandonmentAssessment, heuristicAbandonmentRisk } from './heuristics'
export { mapCategories, normalizeTerm } from './taxonomy-mapper'
export { truncateReadme } from './readme'

let provider: AIProvider | null = null

/**
 * El proveedor de análisis del proceso, elegido una vez desde el entorno.
 * Lanza si la configuración no vale: el worker lo llama al arrancar.
 */
export function getAIProvider(): AIProvider {
  if (!provider) provider = AIProviderRegistry.fromEnv(readEnv()).analysis()
  return provider
}

/** Solo para pruebas: sustituir el proveedor del proceso. */
export function setAIProvider(next: AIProvider | null): void {
  provider = next
}
