import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { databaseUrlForEnv } from './client'
import * as schema from './schema'
import { seedTaxonomy } from './taxonomy'

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/**
 * Aplica las migraciones a la base que toque según el entorno. Idempotente:
 * Drizzle lleva un registro de las aplicadas.
 */
export async function migrateDatabase(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS })
  } finally {
    await client.end({ timeout: 5 })
  }
}

/**
 * Vacía todas las tablas del esquema público salvo el registro de
 * migraciones de Drizzle, que vive en su propio esquema. Se pregunta al
 * catálogo en vez de mantener una lista: una tabla nueva que nadie añadiera a
 * la lista dejaría filas de un fichero de pruebas al siguiente.
 *
 * Después vuelve a sembrar la taxonomía, que en todos los entornos existe
 * desde el seed: una base de pruebas sin catálogo mapearía toda sugerencia de
 * la IA a tags y ninguna prueba vería una categoría.
 */
export async function truncateAllTables(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    const tables = await client<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'
    `
    if (tables.length) {
      const names = tables.map((t) => `"${t.tablename}"`).join(', ')
      await client.unsafe(`TRUNCATE TABLE ${names} CASCADE`)
    }
    await seedTaxonomy(drizzle(client, { schema }))
  } finally {
    await client.end({ timeout: 5 })
  }
}

/** Para la suite: fuerza `test`, migra la base de pruebas y la deja vacía, con el catálogo. */
export async function migrateTestDatabase(): Promise<void> {
  Object.assign(process.env, { NODE_ENV: 'test' })
  const url = databaseUrlForEnv()
  await migrateDatabase(url)
  await truncateAllTables(url)
}

// CLI: `tsx src/migrate.ts` migra la de desarrollo; `--test` la de pruebas.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const isTest = process.argv.includes('--test')
  config({
    path: join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      isTest ? '.env.test' : '.env',
    ),
    override: isTest,
  })
  if (isTest) Object.assign(process.env, { NODE_ENV: 'test' })
  const url = databaseUrlForEnv()
  migrateDatabase(url)
    .then(() => {
      console.log(`migraciones aplicadas en ${url.replace(/\/\/.*@/, '//***@')}`)
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
