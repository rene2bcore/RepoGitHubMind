import { libraryQuerySchema, saveRepositorySchema } from '@rgm/shared'
import { handle, parseBody, parseQuery } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/session'
import { listUserRepositories, saveRepository } from '@/modules/repositories/service'

/**
 * POST /api/v1/repositories · con sesión · guardar por URL.
 * 201 con la relación nueva; 200 si ya estaba en la biblioteca. La identidad
 * sale de la sesión y el límite de intentos es por cuenta (H-07): cada
 * guardado puede costar una llamada a GitHub.
 */
export const POST = handle(async (req) => {
  const user = await getSessionUser(req)
  const body = await parseBody(req, saveRepositorySchema)
  checkRateLimit(`save:${user.id}`)
  const { item, created } = await saveRepository(user.id, body)
  return Response.json({ data: item }, { status: created ? 201 : 200 })
})

/** GET /api/v1/repositories · con sesión · mi biblioteca, con orden, filtros y paginación. */
export const GET = handle(async (req) => {
  const user = await getSessionUser(req)
  const query = parseQuery(req, libraryQuerySchema)
  const { items, meta } = await listUserRepositories(user.id, query)
  return Response.json({ data: items, meta })
})
