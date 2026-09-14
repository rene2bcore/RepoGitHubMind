import { describe, expect, it } from 'vitest'
import { DEFAULT_ANALYSIS_MODEL } from '../src/defaults'
import { AIProviderRegistry, type AIEnv } from '../src/registry'

/**
 * specs/ai · «Proveedor reemplazable»: proveedor y modelo salen del entorno
 * («Cambiar de proveedor»), y un proveedor desconocido impide arrancar con un
 * mensaje claro en vez de fallar en la primera llamada («Proveedor
 * desconocido»).
 */
const env = (overrides: Partial<AIEnv> = {}): AIEnv => ({
  AI_PROVIDER: 'openrouter',
  AI_MODEL_ANALYSIS: undefined,
  AI_API_KEY: 'sk-or-v1-de-prueba',
  AI_FAKE: false,
  ...overrides,
})

describe('AIProviderRegistry', () => {
  it('un AI_PROVIDER desconocido no construye nada y dice qué valores valen, también con AI_FAKE', () => {
    expect(() => AIProviderRegistry.fromEnv(env({ AI_PROVIDER: 'nadie' }))).toThrow(
      /AI_PROVIDER «nadie» no es un proveedor conocido\. Valores válidos: openrouter/,
    )
    expect(() => AIProviderRegistry.fromEnv(env({ AI_PROVIDER: 'nadie', AI_FAKE: true }))).toThrow(
      /AI_PROVIDER/,
    )
    expect(() => AIProviderRegistry.fromEnv(env({ AI_API_KEY: '' }))).toThrow(/Falta AI_API_KEY/)
  })

  it('el modelo sale de AI_MODEL_ANALYSIS, y vacío toma el valor por defecto documentado', () => {
    const configurado = AIProviderRegistry.fromEnv(env({ AI_MODEL_ANALYSIS: 'otro/modelo' }))
    expect(configurado.analysis()).toMatchObject({ name: 'openrouter', model: 'otro/modelo' })
    const porDefecto = AIProviderRegistry.fromEnv(env({ AI_MODEL_ANALYSIS: '' }))
    expect(porDefecto.analysis().model).toBe(DEFAULT_ANALYSIS_MODEL.openrouter)
  })

  it('con AI_FAKE=1 el análisis lo hace el proveedor falso, sin clave', () => {
    const registry = AIProviderRegistry.fromEnv(env({ AI_FAKE: true, AI_API_KEY: undefined }))
    expect(registry.analysis().name).toBe('fake')
  })
})
