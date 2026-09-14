import { registerSchema } from '@rgm/shared'
import { clientAddress, handle, parseBody } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { createSession } from '@/lib/session'
import { registerUser } from '@/modules/auth/service'

/** POST /api/v1/auth/register · pública · 201 con la cuenta y la sesión abierta. */
export const POST = handle(async (req) => {
  checkRateLimit(`register:${clientAddress(req)}`)
  const body = await parseBody(req, registerSchema)
  const user = await registerUser(body)
  const { cookie } = await createSession(user.id)
  return Response.json({ data: user }, { status: 201, headers: { 'Set-Cookie': cookie } })
})
