import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { getDb, closeDb, users } from './index'

/**
 * Semillas de desarrollo (prompt maestro §83). Un usuario de desarrollo con
 * una contraseña de ejemplo documentada, nunca real. Idempotente: si ya
 * existe, no hace nada.
 */
export const DEV_USER = { email: 'dev@repogithubmind.local', password: 'desarrollo123' } as const

export async function seed(): Promise<void> {
  // En producción no hay usuario de desarrollo: su contraseña está en este
  // fichero. Hoy el seed no siembra nada más; la taxonomía llega con H4 y se
  // sembrará en todos los entornos, antes de esta línea.
  if (process.env.NODE_ENV === 'production') return
  const db = getDb()
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${DEV_USER.email}`)
    .limit(1)
  if (existing.length) return
  await db.insert(users).values({
    email: DEV_USER.email,
    passwordHash: await bcrypt.hash(DEV_USER.password, 10),
    role: 'ADMIN',
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') })
  seed()
    .then(async () => {
      console.log(
        process.env.NODE_ENV === 'production'
          ? 'seed: producción, sin usuario de desarrollo'
          : `seed: usuario de desarrollo ${DEV_USER.email} (contraseña de ejemplo: ${DEV_USER.password})`,
      )
      await closeDb()
      process.exit(0)
    })
    .catch(async (error) => {
      console.error(error)
      await closeDb()
      process.exit(1)
    })
}
