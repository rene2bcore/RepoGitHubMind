import type { RepositoryAnalysis } from './schema'

/**
 * Lo que se envía de un repositorio: metadata de GitHub, topics, lenguajes,
 * licencia, releases y el README, que se recorta antes de salir. Nunca
 * código (specs/ai · «Contexto económico»).
 */
export type AnalysisInput = {
  fullName: string
  description: string | null
  homepage: string | null
  primaryLanguage: string | null
  license: string | null
  topics: string[]
  languages: Record<string, number>
  stars: number
  forks: number
  openIssues: number
  archived: boolean
  fork: boolean
  latestRelease: string | null
  latestReleaseAt: Date | null
  githubCreatedAt: Date | null
  githubPushedAt: Date | null
  readme: string | null
}

/** Una categoría del catálogo, tal como la leen el prompt y el mapeador. */
export type CatalogCategory = {
  id: string
  slug: string
  name: string
  path: string
  synonyms: string[]
}

export type AnalysisRequest = {
  repository: AnalysisInput
  catalog: CatalogCategory[]
  /** `AI_MAX_README_CHARS`. */
  maxReadmeChars: number
  /** La fecha contra la que el modelo valora la actividad. */
  now: Date
}

/**
 * Una llamada al proveedor, para `ai_usage`. `estimatedCost` es el que
 * declara el proveedor, o null si no lo declara. `success` es false si la
 * llamada falló o si su salida no validó.
 */
export type AICallUsage = {
  inputTokens: number
  outputTokens: number
  estimatedCost: number | null
  success: boolean
  error: string | null
}

export type AnalysisOutcome = { analysis: RepositoryAnalysis; calls: AICallUsage[] }

/**
 * El único punto por el que el sistema habla con un modelo (ADR-0009). Cada
 * implementación declara su nombre y su modelo, que es lo que se registra en
 * `ai_usage` y en `repository_analyses`.
 *
 * Errores que puede lanzar: `AIProviderCallError` (red, límite, 5xx, clave;
 * con `retryable` y, si el proveedor la da, `retryAfter`) y
 * `AIOutputInvalidError` (dos salidas seguidas que no validan). Los dos
 * llevan las llamadas hechas, para registrarlas aunque no haya análisis.
 */
export interface AIProvider {
  readonly name: string
  readonly model: string
  analyzeRepository(request: AnalysisRequest): Promise<AnalysisOutcome>
}
