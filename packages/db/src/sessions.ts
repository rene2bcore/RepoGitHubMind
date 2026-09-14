import { sql } from 'drizzle-orm'
import { getDb, type Database } from './client'
import { sessions } from './schema'

/**
 * Borra las sesiones caducadas y devuelve cuántas. Una sesión caducada ya
 * no vale (la web compara `expires_at` al leerla); esto solo evita que la
 * tabla crezca sin límite. Lo llama el worker cada hora (ADR-0013).
 */
export async function purgeExpiredSessions(db: Database = getDb()): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(sql`${sessions.expiresAt} <= now()`)
    .returning({ token: sessions.token })
  return rows.length
}
