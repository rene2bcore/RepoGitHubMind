import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getDb, users } from '@rgm/db'
import { POST as register } from '@/app/api/v1/auth/register/route'
import { POST as login } from '@/app/api/v1/auth/login/route'
import { POST as logout } from '@/app/api/v1/auth/logout/route'
import { GET as me } from '@/app/api/v1/auth/me/route'
import { configureRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { cookieFrom, cuentaConSesion, emailUnico, jsonRequest, limpiarBase } from './helpers'

/**
 * specs/auth · Registro de una cuenta nueva · Un email, una sola cuenta,
 * ignorando mayúsculas · Inicio de sesión · La sesión sobrevive a recargar y
 * termina al salir · Protección de los recursos privados.
 *
 * Contra la base de pruebas real (ADR-0003). Un caso por escenario.
 */
describe('auth', () => {
  beforeAll(async () => {
    await limpiarBase()
    configureRateLimit({ max: 1000, windowMs: 60_000 })
  })
  beforeEach(() => resetRateLimit())
  afterAll(() => closeDb())

  describe('Registro de una cuenta nueva', () => {
    it('alta correcta: 201 con la cuenta sin contraseña y con la cookie de sesión', async () => {
      const email = emailUnico()
      const res = await register(
        jsonRequest('/api/v1/auth/register', {
          method: 'POST',
          body: { email, password: 'secreto123', passwordConfirmation: 'secreto123' },
        }),
        {},
      )
      expect(res.status).toBe(201)
      const body = (await res.json()) as { data: Record<string, unknown> }
      expect(body.data).toMatchObject({ email, role: 'USER' })
      expect(Object.keys(body.data).sort()).toEqual(['createdAt', 'email', 'id', 'role'])
      const cookie = res.headers.get('set-cookie') ?? ''
      expect(cookie).toMatch(/^rgm_session=/)
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/SameSite=Lax/)
    })

    it('varios campos inválidos a la vez devuelven un error por cada uno, con su campo', async () => {
      const res = await register(
        jsonRequest('/api/v1/auth/register', {
          method: 'POST',
          body: { email: 'no', password: 'corta', passwordConfirmation: 'otra' },
        }),
        {},
      )
      expect(res.status).toBe(422)
      const { errors } = (await res.json()) as { errors: { field: string; rule: string }[] }
      const fields = errors.map((e) => e.field)
      expect(fields).toEqual(expect.arrayContaining(['email', 'password']))
      for (const e of errors) expect(e.rule).toBeTruthy()
    })

    it('un cuerpo que no es JSON es un 422, no un 500', async () => {
      const req = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{no es json',
      })
      const res = await register(req, {})
      expect(res.status).toBe(422)
    })
  })

  describe('Un email, una sola cuenta, ignorando mayúsculas', () => {
    it('un alta repetida con otras mayúsculas se rechaza como duplicada', async () => {
      const base = emailUnico('grace')
      const alta = (email: string) =>
        register(
          jsonRequest('/api/v1/auth/register', {
            method: 'POST',
            body: { email, password: 'secreto123', passwordConfirmation: 'secreto123' },
          }),
          {},
        )
      expect((await alta(base)).status).toBe(201)
      const res = await alta(base.toUpperCase())
      expect(res.status).toBe(422)
      const { errors } = (await res.json()) as { errors: { field: string; rule: string }[] }
      expect(errors).toEqual([expect.objectContaining({ field: 'email', rule: 'unique' })])
      const [fila] = await getDb().execute<{ count: string }>(
        sql`select count(*)::text as count from ${users} where lower(email) = ${base}`,
      )
      expect(fila?.count).toBe('1')
    })

    it('la carrera de altas la para el índice único y responde 422, no 500', async () => {
      const email = emailUnico('carrera')
      const alta = () =>
        register(
          jsonRequest('/api/v1/auth/register', {
            method: 'POST',
            body: { email, password: 'secreto123', passwordConfirmation: 'secreto123' },
          }),
          {},
        )
      const statuses = (await Promise.all([alta(), alta(), alta()])).map((r) => r.status).sort()
      expect(statuses).toEqual([201, 422, 422])
    })
  })

  describe('Inicio de sesión', () => {
    it('con las credenciales correctas se abre sesión y me devuelve la cuenta', async () => {
      const { email } = await cuentaConSesion()
      const res = await login(
        jsonRequest('/api/v1/auth/login', {
          method: 'POST',
          body: { email, password: 'secreto123' },
        }),
        {},
      )
      expect(res.status).toBe(200)
      const yo = await me(jsonRequest('/api/v1/auth/me', { cookie: cookieFrom(res) }), {})
      expect(yo.status).toBe(200)
      expect(((await yo.json()) as { data: { email: string } }).data.email).toBe(email)
    })

    it('un email desconocido responde igual que una contraseña equivocada', async () => {
      const { email } = await cuentaConSesion()
      const desconocido = await login(
        jsonRequest('/api/v1/auth/login', {
          method: 'POST',
          body: { email: emailUnico('nadie'), password: 'x'.repeat(8) },
        }),
        {},
      )
      const equivocada = await login(
        jsonRequest('/api/v1/auth/login', {
          method: 'POST',
          body: { email, password: 'equivocada1' },
        }),
        {},
      )
      expect(desconocido.status).toBe(401)
      expect(equivocada.status).toBe(401)
      expect(await desconocido.text()).toBe(await equivocada.text())
    })

    it('demasiados intentos desde la misma dirección responden 429', async () => {
      configureRateLimit({ max: 2, windowMs: 60_000 })
      const intento = () =>
        login(
          jsonRequest('/api/v1/auth/login', {
            method: 'POST',
            body: { email: emailUnico('limite'), password: 'x'.repeat(8) },
            headers: { 'x-forwarded-for': '203.0.113.7' },
          }),
          {},
        )
      expect((await intento()).status).toBe(401)
      expect((await intento()).status).toBe(401)
      const tercero = await intento()
      expect(tercero.status).toBe(429)
      expect(await tercero.json()).toEqual({
        errors: [expect.objectContaining({ message: expect.any(String) })],
      })
      configureRateLimit({ max: 1000, windowMs: 60_000 })
    })
  })

  describe('La sesión termina al salir', () => {
    it('cerrar sesión invalida la cookie: la siguiente petición responde 401', async () => {
      const { cookie } = await cuentaConSesion()
      const out = await logout(jsonRequest('/api/v1/auth/logout', { method: 'POST', cookie }), {})
      expect(out.status).toBe(200)
      const despues = await me(jsonRequest('/api/v1/auth/me', { cookie }), {})
      expect(despues.status).toBe(401)
    })

    it('cerrar una sesión no cierra las demás', async () => {
      const { email, cookie: primera } = await cuentaConSesion()
      const segunda = cookieFrom(
        await login(
          jsonRequest('/api/v1/auth/login', {
            method: 'POST',
            body: { email, password: 'secreto123' },
          }),
          {},
        ),
      )
      await logout(jsonRequest('/api/v1/auth/logout', { method: 'POST', cookie: primera }), {})
      expect((await me(jsonRequest('/api/v1/auth/me', { cookie: segunda }), {})).status).toBe(200)
    })
  })

  describe('Protección de los recursos privados', () => {
    it('sin cookie, con una inventada o revocada: 401 y ningún dato', async () => {
      for (const cookie of [undefined, 'rgm_session=inventada']) {
        const res = await me(jsonRequest('/api/v1/auth/me', { cookie }), {})
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ errors: [{ message: expect.any(String) }] })
      }
    })

    it('un userId en el cuerpo no cambia quién soy', async () => {
      const { email, cookie } = await cuentaConSesion()
      const res = await me(
        jsonRequest('/api/v1/auth/me?userId=00000000-0000-0000-0000-000000000000', { cookie }),
        {},
      )
      expect(((await res.json()) as { data: { email: string } }).data.email).toBe(email)
    })
  })
})
