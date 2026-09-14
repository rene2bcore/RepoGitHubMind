import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { closeDb, databaseUrlForEnv, getDb } from '../src/client'

/**
 * ADR-0003 · La suite no puede escribir sobre la base de desarrollo.
 *
 * No se comprueba leyendo la configuración: se pregunta a la conexión viva
 * por su base. Si algún día la elección por entorno se rompe, esta prueba lo
 * dice antes de que la siguiente escriba donde trabaja una persona.
 */
describe('Aislamiento de la base de datos en pruebas', () => {
  afterAll(() => closeDb())

  it('la conexión viva está en repogithubmind_test', async () => {
    const [row] = await getDb().execute<{ current_database: string }>(
      sql`select current_database()`,
    )
    expect(row?.current_database).toBe('repogithubmind_test')
  })

  it('en test la URL sale de DATABASE_URL_TEST y no de DATABASE_URL', () => {
    const url = databaseUrlForEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://x/desarrollo',
      DATABASE_URL_TEST: 'postgres://x/pruebas',
    })
    expect(url).toBe('postgres://x/pruebas')
  })

  it('sin DATABASE_URL_TEST en test se falla en vez de caer en desarrollo', () => {
    expect(() =>
      databaseUrlForEnv({ NODE_ENV: 'test', DATABASE_URL: 'postgres://x/desarrollo' }),
    ).toThrow(/DATABASE_URL_TEST/)
  })
})
