import { personalUpdateSchema, uuidParamSchema } from '@rgm/shared'
import { handle, ok, parseBody, parseParams } from '@/lib/http'
import { getSessionUser } from '@/lib/session'
import { updatePersonal } from '@/modules/repositories/service'

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/v1/repositories/{id}/personal · con sesión · estado, favorito,
 * rating y notas de **mi** relación. El cuerpo se valida antes de resolver
 * el id: `{"rating": 6}` sobre un id inexistente es 422, no 404 (ADR-0005).
 */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const user = await getSessionUser(req)
  const body = await parseBody(req, personalUpdateSchema)
  const { id } = parseParams(await ctx.params, uuidParamSchema)
  return ok(await updatePersonal(user.id, id, body))
})
