import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

/**
 * Elige la base según el entorno (ADR-0003).
 *
 * En `test`, la conexión va a `DATABASE_URL_TEST` y a ninguna otra: si falta,
 * se falla al arrancar en vez de caer en silencio sobre la base de desarrollo.
 * Vitest fija `NODE_ENV=test` de forma incondicional, así que la suite no
 * puede escribir donde trabaja una persona. Playwright levanta la web con
 * `DATABASE_URL` apuntando a la base de pruebas.
 */
export function databaseUrlForEnv(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL
  if (!url) {
    const variable = env.NODE_ENV === 'test' ? 'DATABASE_URL_TEST' : 'DATABASE_URL'
    throw new Error(`Falta ${variable} en el entorno`)
  }
  return url
}

let client: ReturnType<typeof postgres> | null = null
let db: Database | null = null

export function getDb(): Database {
  if (!db) {
    client = postgres(databaseUrlForEnv(), { max: 10, onnotice: () => {} })
    db = drizzle(client, { schema })
  }
  return db
}

export async function closeDb(): Promise<void> {
  if (client) await client.end({ timeout: 5 })
  client = null
  db = null
}

export { schema }
