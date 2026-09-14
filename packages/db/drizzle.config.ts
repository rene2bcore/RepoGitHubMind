import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '../../.env' })

// Solo para `drizzle-kit generate`, que lee el esquema y no la base. Las
// migraciones se aplican con `src/migrate.ts`, que elige la base por entorno.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://rgm:rgm@localhost:5434/repogithubmind',
  },
  strict: true,
})
