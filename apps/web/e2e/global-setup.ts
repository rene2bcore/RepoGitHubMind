import { config } from 'dotenv'

export default async function globalSetup() {
  config({ path: '../../.env.test', override: true })
  const { migrateTestDatabase } = await import('@rgm/db/migrate')
  await migrateTestDatabase()
}
