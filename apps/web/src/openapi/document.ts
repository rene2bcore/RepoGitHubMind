import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { loginSchema, registerSchema, userSchema } from '@rgm/shared'

/**
 * El contrato se construye desde los mismos esquemas Zod que validan los
 * Route Handlers (ADR-0001). Cada ruta nueva se registra aquí en el mismo
 * commit; `pnpm openapi:check` pone CI en rojo si el fichero versionado no
 * coincide con lo que esto genera. Las rutas se escriben en el estilo
 * `{id}` de OpenAPI; CLAUDE.md las lista como `:id` y el verificador normaliza.
 */
export function buildDocument() {
  const registry = new OpenAPIRegistry()

  registry.registerComponent('securitySchemes', 'session', {
    type: 'apiKey',
    in: 'cookie',
    name: 'rgm_session',
    description:
      'Cookie de sesión HttpOnly. La identidad se toma siempre de la sesión en el servidor.',
  })

  const errors = registry.register(
    'Errors',
    z.object({
      errors: z.array(
        z.object({
          message: z.string(),
          field: z.string().optional(),
          rule: z.string().optional(),
        }),
      ),
    }),
  )
  const user = registry.register('User', userSchema)
  const registerBody = registry.register('RegisterBody', registerSchema)
  const loginBody = registry.register('LoginBody', loginSchema)

  const errorResponse = (description: string) => ({
    description,
    content: { 'application/json': { schema: errors } },
  })
  const dataResponse = (description: string, schema: z.ZodType) => ({
    description,
    content: { 'application/json': { schema: z.object({ data: schema }) } },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    summary: 'Crear una cuenta con email y contraseña, y abrir sesión',
    security: [],
    request: { body: { content: { 'application/json': { schema: registerBody } } } },
    responses: {
      201: dataResponse('Cuenta creada y sesión abierta', user),
      422: errorResponse(
        'Validación: email mal formado, contraseña corta, confirmación distinta, o email ya registrado con cualquier combinación de mayúsculas',
      ),
      429: errorResponse('Demasiados intentos desde la misma dirección'),
      500: errorResponse(
        'Error interno del servidor, con la forma cerrada del proyecto y sin detalle',
      ),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    summary: 'Entrar con email y contraseña',
    security: [],
    request: { body: { content: { 'application/json': { schema: loginBody } } } },
    responses: {
      200: dataResponse('Sesión abierta', user),
      401: errorResponse(
        'Email o contraseña incorrectos. La misma respuesta exista o no la cuenta',
      ),
      422: errorResponse('Validación'),
      429: errorResponse('Demasiados intentos desde la misma dirección'),
      500: errorResponse('Error interno del servidor'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    summary: 'Cerrar la sesión: la cookie deja de valer al momento',
    responses: {
      200: dataResponse('Sesión cerrada', z.object({ loggedOut: z.literal(true) })),
      401: errorResponse('Sin sesión'),
      500: errorResponse('Error interno del servidor'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    summary: 'La cuenta de la sesión presentada',
    responses: {
      200: dataResponse('OK', user),
      401: errorResponse('Sin sesión'),
      500: errorResponse('Error interno del servidor'),
    },
  })

  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'RepoGitHubMind API',
      version: '0.2.0',
      description:
        'Contrato de los Route Handlers bajo /api/v1, generado desde los esquemas Zod con `pnpm openapi:generate` y vigilado en CI con `pnpm openapi:check` (ADR-0001). Toda respuesta de éxito va envuelta en { data } y toda respuesta de error en { errors: [...] }. Las Server Actions no forman parte del contrato.',
    },
    security: [{ session: [] }],
  })
}

/** JSON estable: dos espacios y salto final, para que el diff sea legible. */
export function serialize(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`
}
