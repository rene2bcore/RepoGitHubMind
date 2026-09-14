import { uuidParamSchema } from '@rgm/shared'
import { handle, ok, parseParams } from '@/lib/http'
import { getSessionUser } from '@/lib/session'
import { getUserRepositoryDetail } from '@/modules/repositories/service'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/v1/repositories/{id} · con sesión · el detalle de mi relación,
 * con README y lenguajes. Un id de otra cuenta es 404, igual que uno que no
 * existe (specs/library · «Id de otra cuenta»).
 */
export const GET = handle<Ctx>(async (req, ctx) => {
  const user = await getSessionUser(req)
  const { id } = parseParams(await ctx.params, uuidParamSchema)
  return ok(await getUserRepositoryDetail(user.id, id))
})
