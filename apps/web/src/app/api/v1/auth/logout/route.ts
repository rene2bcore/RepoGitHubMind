import { handle } from '@/lib/http'
import { destroySession, getSessionUser, readSessionToken } from '@/lib/session'

/** POST /api/v1/auth/logout · con sesión · borra la sesión: la cookie deja de valer al momento. */
export const POST = handle(async (req) => {
  await getSessionUser(req)
  const cookie = await destroySession(readSessionToken(req) ?? '')
  return Response.json(
    { data: { loggedOut: true } },
    { status: 200, headers: { 'Set-Cookie': cookie } },
  )
})
