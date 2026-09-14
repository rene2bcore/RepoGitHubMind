import { describe, expect, it } from 'vitest'
import { personalUpdateSchema, registerSchema, zodToErrors } from '../src/schemas'

/**
 * specs/auth · «Validación de los datos de registro» y «Varios campos
 * inválidos a la vez»: la respuesta trae un error por campo, no solo el
 * primero. specs/library · «Cuerpo vacío» y «Rating fuera de rango».
 */
describe('registerSchema', () => {
  it('normaliza el email a minúsculas', () => {
    const r = registerSchema.parse({
      email: 'Ada@Example.com',
      password: 'secreto123',
      passwordConfirmation: 'secreto123',
    })
    expect(r.email).toBe('ada@example.com')
  })

  it('devuelve los tres errores a la vez, cada uno con su campo', () => {
    const r = registerSchema.safeParse({
      email: 'no',
      password: 'corta',
      passwordConfirmation: 'otra',
    })
    expect(r.success).toBe(false)
    if (r.success) return
    const fields = zodToErrors(r.error).map((e) => e.field)
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']))
    expect(fields.length).toBeGreaterThanOrEqual(2)
  })

  it('exige que la confirmación coincida, sobre el campo passwordConfirmation', () => {
    const r = registerSchema.safeParse({
      email: 'ada@example.com',
      password: 'secreto123',
      passwordConfirmation: 'secreto124',
    })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(zodToErrors(r.error)).toEqual([
      expect.objectContaining({ field: 'passwordConfirmation' }),
    ])
  })
})

describe('personalUpdateSchema', () => {
  it('rechaza un cuerpo vacío', () => {
    expect(personalUpdateSchema.safeParse({}).success).toBe(false)
  })
  it('rechaza un rating fuera de 1..5 y un estado inventado', () => {
    expect(personalUpdateSchema.safeParse({ rating: 6 }).success).toBe(false)
    expect(personalUpdateSchema.safeParse({ status: 'DONE' }).success).toBe(false)
  })
  it('admite quitar la nota con null', () => {
    expect(personalUpdateSchema.parse({ notes: null })).toEqual({ notes: null })
  })
})
