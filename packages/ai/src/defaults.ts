/**
 * El único sitio del código con nombres de modelo (PA-2, PA-3, specs/ai ·
 * «Proveedor reemplazable»). Se usan solo cuando `AI_MODEL_ANALYSIS` o
 * `AI_MODEL_EMBEDDING` están vacíos; cambiar de modelo es cambiar esa
 * variable, no este fichero. Documentado en docs/ai-architecture.md y
 * docs/prd.md §10.
 */
export const DEFAULT_ANALYSIS_MODEL = {
  openrouter: 'google/gemini-2.5-flash-lite',
} as const

export const DEFAULT_EMBEDDING_MODEL = {
  openrouter: 'openai/text-embedding-3-small',
} as const

/**
 * La dimensión de `repository_embeddings.embedding` (PA-3). Un modelo que
 * devuelva otra se rechaza antes de guardar; cambiarla es una migración.
 */
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Similitud de coseno mínima para que un repositorio entre en la búsqueda por
 * su parte semántica. Depende del modelo, no del producto: calibrada con
 * `openai/text-embedding-3-small` el 2026-09-14 (docs/ai-architecture.md ·
 * «Embeddings»). Otro modelo en `AI_MODEL_EMBEDDING` obliga a revisarla.
 */
export const DEFAULT_MIN_SIMILARITY = {
  openrouter: 0.25,
} as const

export type ProviderName = keyof typeof DEFAULT_ANALYSIS_MODEL
