import { RateLimitError } from '@rgm/shared'

/**
 * Rate limiting por clave en memoria, ventana fija. Suficiente para una
 * instancia (prompt maestro §41); con varias instancias iría a PostgreSQL,
 * y ese es un ADR que no hace falta todavía.
 */
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
let config = { max: 10, windowMs: 60_000 }

export function checkRateLimit(key: string): void {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs })
    return
  }
  bucket.count += 1
  if (bucket.count > config.max) throw new RateLimitError()
}

/** Solo para pruebas: cambiar el tope y limpiar las ventanas entre casos. */
export function configureRateLimit(next: Partial<typeof config>): void {
  config = { ...config, ...next }
  buckets.clear()
}

export function resetRateLimit(): void {
  buckets.clear()
}
