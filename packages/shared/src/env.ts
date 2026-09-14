import { z } from 'zod'

/**
 * Variables de entorno, validadas al arrancar con Zod (prompt maestro §52).
 *
 * `DEBUG_HTTP_ERRORS` es booleano **con tipo**: como cadena, `'false'` sería
 * truthy y el volcado de depuración quedaría encendido en todos los entornos
 * con el `.env.example` diciendo `false` (ADR-0004).
 */
const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true')

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET necesita al menos 16 caracteres'),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_FAKE: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1'),
  AI_ANALYSIS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  AI_PROVIDER: z.string().default('openrouter'),
  AI_MODEL_ANALYSIS: z.string().optional(),
  AI_EMBEDDING_PROVIDER: z.string().default('openrouter'),
  AI_MODEL_EMBEDDING: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MAX_README_CHARS: z.coerce.number().int().positive().default(12000),
  AI_ANALYSIS_TTL_DAYS: z.coerce.number().int().positive().default(90),
  DEBUG_HTTP_ERRORS: bool,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info'),
})
export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Variables de entorno inválidas: ${detalle}`)
  }
  if (source === process.env) cached = parsed.data
  return parsed.data
}

/** Solo para pruebas: olvida la caché cuando el entorno cambia entre casos. */
export function resetEnvCache(): void {
  cached = null
}
