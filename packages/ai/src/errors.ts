import type { AICallUsage } from './provider'

/**
 * El proveedor no dio una respuesta utilizable: red, tiempo agotado, límite,
 * 5xx o clave rechazada. `retryable` decide si la cola lo vuelve a intentar
 * con backoff; una clave inválida no mejora esperando.
 */
export class AIProviderCallError extends Error {
  readonly retryable: boolean
  readonly retryAfter?: Date
  calls: AICallUsage[]

  constructor(
    message: string,
    options: { retryable: boolean; retryAfter?: Date; calls?: AICallUsage[] },
  ) {
    super(message)
    this.name = 'AIProviderCallError'
    this.retryable = options.retryable
    this.retryAfter = options.retryAfter
    this.calls = options.calls ?? [
      { inputTokens: 0, outputTokens: 0, estimatedCost: null, success: false, error: message },
    ]
  }
}

/**
 * Dos salidas seguidas que no cumplen el esquema: la original y la corregida
 * (specs/ai · «Salida que se pasa de largo»). No es reintentable: el mismo
 * contexto daría lo mismo, y cada intento cuesta.
 */
export class AIOutputInvalidError extends Error {
  readonly retryable = false
  readonly issues: string[]
  readonly calls: AICallUsage[]

  constructor(issues: string[], calls: AICallUsage[]) {
    super(`La salida de la IA no validó dos veces: ${issues.slice(0, 5).join('; ')}`)
    this.name = 'AIOutputInvalidError'
    this.issues = issues
    this.calls = calls
  }
}
