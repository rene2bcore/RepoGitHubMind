import { AppError, INTERNAL_ERROR_BODY, ValidationError, zodToErrors, readEnv } from '@rgm/shared'
import type { z } from 'zod'

type Handler<C> = (req: Request, ctx: C) => Promise<Response>

/**
 * El manejador de errores único (ADR-0004). Todo Route Handler pasa por aquí.
 *
 * Un `AppError` sale con su código y su forma. Cualquier otra excepción es un
 * 500 y sale con la forma cerrada, sin su mensaje: el `message` de un error
 * de base de datos es la sentencia SQL entera. El detalle va al log del
 * servidor con id de petición. Solo `DEBUG_HTTP_ERRORS=true`, booleano y a
 * propósito, añade el mensaje a la respuesta.
 */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (error) {
      if (error instanceof AppError) {
        return Response.json(error.toBody(), { status: error.status })
      }
      const requestId = crypto.randomUUID()
      console.error(`[${requestId}] ${req.method} ${new URL(req.url).pathname}`, error)
      const debug = readEnv().DEBUG_HTTP_ERRORS
      const body = debug
        ? { errors: [{ message: `[${requestId}] ${(error as Error)?.message ?? 'error'}` }] }
        : INTERNAL_ERROR_BODY
      return Response.json(body, { status: 500 })
    }
  }
}

/** Toda respuesta de éxito va envuelta en `{ data }`. */
export function ok<T>(data: T, init: ResponseInit = {}): Response {
  return Response.json({ data }, { status: 200, ...init })
}

/** El cuerpo JSON validado con Zod. Un cuerpo ilegible es un 422, no un 500. */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ValidationError([
      { field: '_', rule: 'json', message: 'El cuerpo no es JSON válido' },
    ])
  }
  const result = schema.safeParse(raw)
  if (!result.success) throw new ValidationError(zodToErrors(result.error))
  return result.data
}

/** Los parámetros de la query validados con Zod. */
export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) throw new ValidationError(zodToErrors(result.error))
  return result.data
}

/**
 * La dirección de quien pide, para el rate limiting. Las cabeceras
 * `cf-connecting-ip` y `x-forwarded-for` las escribe quien quiera si no hay
 * un proxy propio delante que las sobrescriba; por eso solo se leen con
 * `TRUST_PROXY=true` (H-07). Sin proxy, todas las peticiones comparten
 * clave: un Route Handler de Next no ve la dirección del socket.
 */
export function clientAddress(req: Request): string {
  if (!readEnv().TRUST_PROXY) return 'sin-proxy'
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'sin-proxy'
  )
}
