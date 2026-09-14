import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  analysisRequestSchema,
  libraryQuerySchema,
  listMetaSchema,
  loginSchema,
  personalUpdateSchema,
  registerSchema,
  saveRepositorySchema,
  userRepositoryDetailSchema,
  userRepositorySchema,
  uuidParamSchema,
  userSchema,
} from '@rgm/shared'

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
  const userRepository = registry.register('UserRepository', userRepositorySchema)
  const saveRepositoryBody = registry.register('SaveRepositoryBody', saveRepositorySchema)
  const listMeta = registry.register('ListMeta', listMetaSchema)
  const userRepositoryDetail = registry.register('UserRepositoryDetail', userRepositoryDetailSchema)
  const personalUpdateBody = registry.register('PersonalUpdateBody', personalUpdateSchema)
  const analysisRequestBody = registry.register('AnalysisRequestBody', analysisRequestSchema)

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

  registry.registerPath({
    method: 'post',
    path: '/api/v1/repositories',
    summary: 'Guardar un repositorio público de GitHub por su URL',
    description:
      'Cualquier variante de la URL normaliza a owner/repo. El repositorio es global y se pide a GitHub una sola vez; la respuesta llega con la metadata presente y el análisis de IA pendiente. El token de GitHub nunca sale.',
    request: { body: { content: { 'application/json': { schema: saveRepositoryBody } } } },
    responses: {
      201: dataResponse('Guardado en la biblioteca de la cuenta', userRepository),
      200: dataResponse('Ya estaba en la biblioteca: la relación existente', userRepository),
      401: errorResponse('Sin sesión'),
      404: errorResponse('GitHub no conoce ese repositorio, o es privado'),
      422: errorResponse('La URL no es de un repositorio de GitHub'),
      429: errorResponse(
        'Demasiados guardados desde la cuenta, o GitHub ha limitado las peticiones',
      ),
      500: errorResponse('Error interno del servidor'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/repositories',
    summary: 'Mi biblioteca: las relaciones privadas de la cuenta, con orden, filtros y paginación',
    request: { query: libraryQuerySchema },
    responses: {
      200: {
        description: 'Solo lo de la cuenta con sesión. Vacía es 200 con data [] y meta.total 0',
        content: {
          'application/json': {
            schema: z.object({ data: z.array(userRepository), meta: listMeta }),
          },
        },
      },
      401: errorResponse('Sin sesión'),
      422: errorResponse(
        'Un valor de orden o de filtro fuera del dominio, un parámetro desconocido, o una categoría que el catálogo no conoce',
      ),
      500: errorResponse('Error interno del servidor'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/repositories/{id}',
    summary: 'El detalle de mi relación con un repositorio, con README y lenguajes',
    request: { params: uuidParamSchema },
    responses: {
      200: dataResponse('Mi relación, el repositorio y su README crudo', userRepositoryDetail),
      401: errorResponse('Sin sesión'),
      404: errorResponse('No existe, o pertenece a otra cuenta: la misma respuesta'),
      500: errorResponse('Error interno del servidor'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/repositories/{id}/personal',
    summary: 'Cambiar mi estado, favorito, rating o notas sobre un repositorio',
    description:
      'El cuerpo se valida antes de resolver el id: un valor fuera de rango es 422 aunque el id no exista. La respuesta es la relación releída de la base.',
    request: {
      params: uuidParamSchema,
      body: { content: { 'application/json': { schema: personalUpdateBody } } },
    },
    responses: {
      200: dataResponse('Mi relación actualizada', userRepository),
      401: errorResponse('Sin sesión'),
      404: errorResponse('No existe, o pertenece a otra cuenta: la misma respuesta'),
      422: errorResponse(
        'Estado fuera de los nueve, rating fuera de 1..5, notas de más de 4000 caracteres, o cuerpo vacío',
      ),
      500: errorResponse('Error interno del servidor'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/repositories/{id}/analysis',
    summary: 'Reintentar o forzar el análisis de IA de un repositorio de mi biblioteca',
    description:
      'El análisis es del repositorio global y lo reutilizan todas las cuentas. Sin `force`, solo se encola si no hay uno vigente: no existe, falló, caducó o el repositorio tiene pushes posteriores. Con `force: true` se rehace aunque esté vigente; el anterior se sigue viendo hasta que termine el nuevo. El cuerpo se valida antes de resolver el id.',
    request: {
      params: uuidParamSchema,
      body: { content: { 'application/json': { schema: analysisRequestBody } } },
    },
    responses: {
      202: dataResponse('Hay un análisis en camino', userRepository),
      200: dataResponse('No hacía falta, o la IA está desactivada', userRepository),
      401: errorResponse('Sin sesión'),
      404: errorResponse('No existe, o pertenece a otra cuenta: la misma respuesta'),
      422: errorResponse(
        'Cuerpo que no es JSON, `force` que no es booleano, o un campo desconocido',
      ),
      429: errorResponse('Demasiadas peticiones de análisis desde la cuenta'),
      500: errorResponse('Error interno del servidor'),
    },
  })

  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'RepoGitHubMind API',
      version: '0.5.0',
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
