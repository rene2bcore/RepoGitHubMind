import { randomBytes } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { getDb, sessions, users } from '@rgm/db'
import { AuthorizationError, readEnv, type User } from '@rgm/shared'

export const SESSION_COOKIE = 'rgm_session'
const SESSION_DAYS = 30

/**
 * Sesiones propias sobre la tabla `sessions` (ADR-0013): token opaco en una
 * cookie HttpOnly, SameSite=Lax, Secure cuando la app se sirve por HTTPS.
 * Cerrar sesión borra la fila, y la cookie deja de valer al momento.
 *
 * `getSessionUser` es **la única** forma de saber quién pregunta. Ningún
 * Route Handler acepta un `userId` del cliente (prompt maestro §41).
 */
export async function createSession(userId: string): Promise<{ token: string; cookie: string }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await getDb().insert(sessions).values({ token, userId, expiresAt })
  return { token, cookie: serializeCookie(token, expiresAt) }
}

export async function destroySession(token: string): Promise<string> {
  await getDb().delete(sessions).where(eq(sessions.token, token))
  return serializeCookie('', new Date(0))
}

function serializeCookie(value: string, expires: Date): string {
  const secure = readEnv().AUTH_URL.startsWith('https://') ? '; Secure' : ''
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return rest.join('=') || null
  }
  return null
}

async function userForToken(token: string | null): Promise<User | null> {
  if (!token) return null
  const [row] = await getDb()
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.token, token))
    .limit(1)
  if (!row || row.expiresAt.getTime() <= Date.now()) return null
  return { id: row.id, email: row.email, role: row.role, createdAt: row.createdAt.toISOString() }
}

/** Para Route Handlers: 401 sin datos si no hay sesión válida. */
export async function getSessionUser(req: Request): Promise<User> {
  const user = await userForToken(readSessionToken(req))
  if (!user) throw new AuthorizationError()
  return user
}

/** Para componentes de servidor: null si no hay sesión. */
export async function currentUser(): Promise<User | null> {
  const store = await cookies()
  return userForToken(store.get(SESSION_COOKIE)?.value ?? null)
}

/** Sesiones caducadas que sobran. Lo llama el worker de vez en cuando; nada depende de ello. */
export async function purgeExpiredSessions(): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(sql`${sessions.expiresAt} <= now()`)
}
