import { loginSchema } from '@rgm/shared'
import { clientAddress, handle, parseBody } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { createSession } from '@/lib/session'
import { authenticate } from '@/modules/auth/service'

/** POST /api/v1/auth/login · pública · 200 con la cuenta y la sesión abierta. */
export const POST = handle(async (req) => {
  checkRateLimit(`login:${clientAddress(req)}`)
  const body = await parseBody(req, loginSchema)
  const user = await authenticate(body)
  const { cookie } = await createSession(user.id)
  return Response.json({ data: user }, { status: 200, headers: { 'Set-Cookie': cookie } })
})
