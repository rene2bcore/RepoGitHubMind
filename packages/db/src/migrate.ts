import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { databaseUrlForEnv } from './client'

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

/** Para la suite: fuerza `test`, migra la base de pruebas y la deja vacía. */
export async function migrateTestDatabase(): Promise<void> {
  Object.assign(process.env, { NODE_ENV: 'test' })
  const url = databaseUrlForEnv()
  await migrateDatabase(url)
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await client.unsafe('TRUNCATE TABLE sessions, accounts, verification_tokens, users CASCADE')
  } finally {
    await client.end({ timeout: 5 })
  }
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
