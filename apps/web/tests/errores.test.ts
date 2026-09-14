import { afterAll, describe, expect, it } from 'vitest'
import { closeDb } from '@rgm/db'
import { handle } from '@/lib/http'
import { jsonRequest } from './helpers'

/**
 * ADR-0004 · Un error inesperado no devuelve su mensaje.
 *
 * Se provoca un fallo con un mensaje que parece SQL y se comprueba el cuerpo
 * entero: la forma cerrada, y ninguno de los rastros. Es la garantía; la
 * comprobación del verificador sobre `http.ts` es el aviso temprano.
 */
describe('Manejador de errores único', () => {
  afterAll(() => closeDb())

  it('un 5xx responde la forma cerrada sin el mensaje de la excepción', async () => {
    const rota = handle(async () => {
      throw new Error(
        "insert into users (email, password_hash) values ('ada@example.com', '$2b$10$abc')",
      )
    })
    const res = await rota(jsonRequest('/api/v1/rota'), {})
    expect(res.status).toBe(500)
    const texto = await res.text()
    expect(JSON.parse(texto)).toEqual({ errors: [{ message: 'Error interno del servidor' }] })
    for (const rastro of ['insert into', '$2b$', 'password_hash', 'at ', '.ts:']) {
      expect(texto).not.toContain(rastro)
    }
  })
})
