import { analysisRequestSchema, uuidParamSchema } from '@rgm/shared'
import { handle, parseBody, parseParams } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/session'
import { requestRepositoryAnalysis } from '@/modules/repositories/service'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/v1/repositories/{id}/analysis · con sesión · reintentar el
 * análisis de un repositorio de mi biblioteca, o forzarlo con `{ "force":
 * true }`. 202 si queda un análisis en camino; 200 si no hacía falta o la IA
 * está apagada. El cuerpo se valida antes de resolver el id (ADR-0005), y el
 * límite es por cuenta: cada análisis puede costar una llamada al proveedor.
 */
export const POST = handle<Ctx>(async (req, ctx) => {
  const user = await getSessionUser(req)
  const body = await parseBody(req, analysisRequestSchema)
  const { id } = parseParams(await ctx.params, uuidParamSchema)
  checkRateLimit(`analysis:${user.id}`)
  const { item, enqueued } = await requestRepositoryAnalysis(user.id, id, body)
  return Response.json({ data: item }, { status: enqueued ? 202 : 200 })
})
