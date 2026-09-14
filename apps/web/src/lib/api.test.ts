import { describe, expect, it, vi } from 'vitest'
import { ApiError, onUnauthorized, request } from './api'

const json = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }))

/**
 * El único punto de contacto con el backend: desenvolver `{ data }`, traducir
 * `{ errors }` a `ApiError` con errores por campo, y avisar solo ante un 401
 * (specs/auth · «Pantallas de acceso»).
 */
describe('request', () => {
  it('desenvuelve data', async () => {
    const fetchImpl = json(200, { data: { id: '1' } })
    await expect(request('/x', {}, fetchImpl)).resolves.toEqual({ id: '1' })
  })

  it('traduce un 422 a ApiError con errores por campo', async () => {
    const fetchImpl = json(422, {
      errors: [
        { field: 'email', rule: 'unique', message: 'Ya existe' },
        { field: 'password', rule: 'too_small', message: 'Corta' },
      ],
    })
    const error = (await request('/x', {}, fetchImpl).catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.fieldErrors).toEqual({ email: 'Ya existe', password: 'Corta' })
  })

  it('avisa ante un 401 y no ante otros errores', async () => {
    const listener = vi.fn()
    const stop = onUnauthorized(listener)
    await request('/x', {}, json(401, { errors: [{ message: 'sin sesión' }] })).catch(() => {})
    await request('/x', {}, json(500, { errors: [{ message: 'error' }] })).catch(() => {})
    stop()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('no avisa por un 401 silenciado, que es el de rehidratar la sesión', async () => {
    const listener = vi.fn()
    const stop = onUnauthorized(listener)
    await request(
      '/x',
      { silenciarRechazo: true },
      json(401, { errors: [{ message: 'x' }] }),
    ).catch(() => {})
    stop()
    expect(listener).not.toHaveBeenCalled()
  })

  it('un fallo de red es un ApiError con estado 0 y mensaje humano', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    const error = (await request('/x', {}, fetchImpl).catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/conectar/)
  })
})
