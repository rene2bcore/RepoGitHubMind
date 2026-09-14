import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

// Antes de construir ningún esquema: en Zod 4 los métodos se añaden al crear
// cada instancia, así que la extensión tiene que existir cuando se crean.
extendZodWithOpenApi(z)

/**
 * Los esquemas Zod son la única definición de entrada y salida de la API. Los
 * usan los Route Handlers para validar, los formularios del frontend para
 * validar antes de enviar, y el generador del contrato OpenAPI (ADR-0001).
 * Un nombre de regla (`rule`) estable por cada `422`, para que el frontend
 * lo traduzca sin depender del texto.
 */

export const PERSONAL_STATUSES = [
  'NEW',
  'TO_REVIEW',
  'REVIEWED',
  'TESTING',
  'INSTALLED',
  'USING',
  'FAVORITE',
  'REJECTED',
  'ARCHIVED',
] as const
export type PersonalStatus = (typeof PERSONAL_STATUSES)[number]

export const ROLES = ['USER', 'ADMIN'] as const

const email = z
  .string()
  .trim()
  .min(1, 'El email es obligatorio')
  .max(254, 'El email es demasiado largo')
  .email('No parece un email')
  .transform((v) => v.toLowerCase())

export const registerSchema = z
  .object({
    email,
    password: z
      .string()
      .min(8, 'La contraseña necesita al menos 8 caracteres')
      .max(128, 'La contraseña es demasiado larga'),
    passwordConfirmation: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirmation'],
  })
export type RegisterBody = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'La contraseña es obligatoria').max(128),
})
export type LoginBody = z.infer<typeof loginSchema>

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(ROLES),
  createdAt: z.iso.datetime(),
})
export type User = z.infer<typeof userSchema>

export const saveRepositorySchema = z.object({
  url: z.string().trim().min(1, 'La URL es obligatoria').max(500),
  source: z.string().trim().max(80).optional(),
})
export type SaveRepositoryBody = z.infer<typeof saveRepositorySchema>

export const personalUpdateSchema = z
  .object({
    status: z.enum(PERSONAL_STATUSES).optional(),
    favorite: z.boolean().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada que cambiar', path: [] })
export type PersonalUpdateBody = z.infer<typeof personalUpdateSchema>

export const LIBRARY_SORTS = ['savedAt', 'pushedAt', 'stars', 'name', 'rating'] as const

const booleanParam = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional()

export const libraryQuerySchema = z.object({
  status: z.enum(PERSONAL_STATUSES).optional(),
  favorite: booleanParam,
  language: z.string().trim().min(1).max(60).optional(),
  license: z.string().trim().min(1).max(60).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  minStars: z.coerce.number().int().min(0).optional(),
  sort: z.enum(LIBRARY_SORTS).default('savedAt'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
})
export type LibraryQuery = z.infer<typeof libraryQuerySchema>

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Escribe al menos dos caracteres').max(200),
  scope: z.enum(['library', 'global']).default('library'),
  category: z.string().trim().min(1).max(120).optional(),
  language: z.string().trim().min(1).max(60).optional(),
  license: z.string().trim().min(1).max(60).optional(),
  minStars: z.coerce.number().int().min(0).optional(),
  status: z.enum(PERSONAL_STATUSES).optional(),
  favorite: booleanParam,
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type SearchQuery = z.infer<typeof searchQuerySchema>

export const uuidParamSchema = z.object({ id: z.uuid() })

/**
 * Traduce un fallo de Zod a la forma de error del proyecto: un elemento por
 * campo, con `rule` estable. Todos los campos a la vez, no solo el primero.
 */
export function zodToErrors(error: z.ZodError): { message: string; field: string; rule: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || '_',
    rule: issue.code,
    message: issue.message,
  }))
}
