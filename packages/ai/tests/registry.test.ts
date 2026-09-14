import { describe, expect, it } from 'vitest'
import { DEFAULT_ANALYSIS_MODEL, DEFAULT_EMBEDDING_MODEL } from '../src/defaults'
import { AIProviderRegistry, type AIEnv } from '../src/registry'

/**
 * specs/ai · «Proveedor reemplazable»: proveedor y modelo salen del entorno
 * («Cambiar de proveedor»), y un proveedor desconocido impide arrancar con un
 * mensaje claro en vez de fallar en la primera llamada («Proveedor
 * desconocido»). Lo mismo para los embeddings de specs/search (PA-3).
 */
const env = (overrides: Partial<AIEnv> = {}): AIEnv => ({
  AI_PROVIDER: 'openrouter',
  AI_MODEL_ANALYSIS: undefined,
  AI_EMBEDDING_PROVIDER: 'openrouter',
  AI_MODEL_EMBEDDING: undefined,
  AI_API_KEY: 'sk-or-v1-de-prueba',
  AI_FAKE: false,
  ...overrides,
})

describe('AIProviderRegistry', () => {
  it('un AI_PROVIDER o AI_EMBEDDING_PROVIDER desconocido no construye nada y dice qué valores valen, también con AI_FAKE', () => {
    expect(() => AIProviderRegistry.fromEnv(env({ AI_PROVIDER: 'nadie' }))).toThrow(
      /AI_PROVIDER «nadie» no es un proveedor conocido\. Valores válidos: openrouter/,
    )
    expect(() => AIProviderRegistry.fromEnv(env({ AI_PROVIDER: 'nadie', AI_FAKE: true }))).toThrow(
      /AI_PROVIDER/,
    )
    expect(() =>
      AIProviderRegistry.fromEnv(env({ AI_EMBEDDING_PROVIDER: 'nadie', AI_FAKE: true })),
    ).toThrow(/AI_EMBEDDING_PROVIDER «nadie» no es un proveedor conocido/)
    expect(() => AIProviderRegistry.fromEnv(env({ AI_API_KEY: '' }))).toThrow(/Falta AI_API_KEY/)
  })

  it('los modelos salen de AI_MODEL_ANALYSIS y AI_MODEL_EMBEDDING, y vacíos toman el valor por defecto documentado', () => {
    const configurado = AIProviderRegistry.fromEnv(
      env({ AI_MODEL_ANALYSIS: 'otro/modelo', AI_MODEL_EMBEDDING: 'otro/embedding' }),
    )
    expect(configurado.analysis()).toMatchObject({ name: 'openrouter', model: 'otro/modelo' })
    expect(configurado.embedding()).toMatchObject({
      name: 'openrouter',
      model: 'otro/embedding',
      dimensions: 1536,
    })
    const porDefecto = AIProviderRegistry.fromEnv(
      env({ AI_MODEL_ANALYSIS: '', AI_MODEL_EMBEDDING: '' }),
    )
    expect(porDefecto.analysis().model).toBe(DEFAULT_ANALYSIS_MODEL.openrouter)
    expect(porDefecto.embedding().model).toBe(DEFAULT_EMBEDDING_MODEL.openrouter)
  })

  it('con AI_FAKE=1 el análisis y los embeddings los hacen los proveedores falsos, sin clave', () => {
    const registry = AIProviderRegistry.fromEnv(env({ AI_FAKE: true, AI_API_KEY: undefined }))
    expect(registry.analysis().name).toBe('fake')
    expect(registry.embedding().name).toBe('fake')
  })
})
