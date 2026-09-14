import { handle, ok } from '@/lib/http'
import { getSessionUser } from '@/lib/session'

/** GET /api/v1/auth/me · con sesión · la cuenta del token presentado. */
export const GET = handle(async (req) => ok(await getSessionUser(req)))
