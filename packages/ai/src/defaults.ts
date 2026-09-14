/**
 * El único sitio del código con nombres de modelo (PA-2, specs/ai ·
 * «Proveedor reemplazable»). Se usan solo cuando `AI_MODEL_ANALYSIS` está
 * vacío; cambiar de modelo es cambiar esa variable, no este fichero.
 * Documentado en docs/ai-architecture.md y docs/prd.md §10.
 */
export const DEFAULT_ANALYSIS_MODEL = {
  openrouter: 'google/gemini-2.5-flash-lite',
} as const

export type ProviderName = keyof typeof DEFAULT_ANALYSIS_MODEL
