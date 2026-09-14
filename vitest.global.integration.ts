import { config } from 'dotenv'

/**
 * Antes de cualquier prueba de integración: el entorno de pruebas y la base
 * de pruebas migrada desde cero.
 *
 * `.env.test` se carga con `override`: la suite no puede heredar el `.env` de
 * quien la ejecuta. `NODE_ENV` lo pone Vitest a `test` y aquí se comprueba, no
 * se confía: si no lo fuera, la conexión elegiría la base de desarrollo.
 */
export default async function setup() {
  config({ path: '.env.test', override: true })
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`NODE_ENV es «${process.env.NODE_ENV}» y tiene que ser «test»`)
  }
  const { migrateTestDatabase } = await import('./packages/db/src/migrate')
  await migrateTestDatabase()
}
