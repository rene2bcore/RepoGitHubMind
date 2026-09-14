import { searchQuerySchema } from '@rgm/shared'
import { handle, parseQuery } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/session'
import { searchRepositories } from '@/modules/search/service'

/**
 * GET /api/v1/search · con sesión · búsqueda híbrida en mi biblioteca o en el
 * corpus global. Sin sesión, 401; la consulta y los filtros se validan antes
 * de tocar nada (ADR-0005); el límite es por cuenta (H-07), porque cada
 * búsqueda puede costar una llamada de embeddings.
 */
export const GET = handle(async (req) => {
  const user = await getSessionUser(req)
  const query = parseQuery(req, searchQuerySchema)
  checkRateLimit(`search:${user.id}`)
  const { items, meta } = await searchRepositories(user.id, query)
  return Response.json({ data: items, meta })
})
