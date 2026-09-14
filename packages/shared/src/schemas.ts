import { z } from './zod'

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

export const ANALYSIS_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'DISABLED'] as const
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number]
export const ABANDONMENT_RISKS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] as const
export type AbandonmentRisk = (typeof ABANDONMENT_RISKS)[number]
/** De dónde sale la valoración de abandono: la heurística manda cuando tiene datos. */
export const ABANDONMENT_RISK_SOURCES = ['HEURISTIC', 'AI'] as const
export type AbandonmentRiskSource = (typeof ABANDONMENT_RISK_SOURCES)[number]

/**
 * El análisis de IA de un repositorio global, el mismo para todas las cuentas
 * (specs/ai). Los campos de contenido van vacíos mientras `status` no sea
 * `COMPLETED`. `abandonmentRisk` es una valoración, nunca un hecho: la
 * heurística manda cuando hay datos de actividad y la IA solo cubre
 * `UNKNOWN`; `abandonmentRiskSource` dice cuál de las dos es, para que la
 * interfaz lo etiquete. `tags` son los de la IA; los topics de GitHub van
 * aparte en `repository.topics`. La confianza del modelo no sale: no se
 * muestra una precisión que no existe.
 */
export const analysisSchema = z.object({
  status: z.enum(ANALYSIS_STATUSES),
  summary: z.string().nullable(),
  purpose: z.string().nullable(),
  mainUseCases: z.array(z.string()),
  installationSummary: z.string().nullable(),
  deploymentType: z.array(z.string()),
  frameworks: z.array(z.string()),
  maturity: z.string().nullable(),
  advantages: z.array(z.string()),
  limitations: z.array(z.string()),
  targetUsers: z.array(z.string()),
  activityAssessment: z.string().nullable(),
  tags: z.array(z.string()),
  abandonmentRisk: z.enum(ABANDONMENT_RISKS),
  abandonmentRiskSource: z.enum(ABANDONMENT_RISK_SOURCES),
  aiAnalyzedAt: z.iso.datetime().nullable(),
})
export type Analysis = z.infer<typeof analysisSchema>

/** Una categoría del catálogo controlado (docs/taxonomy.md). `path` es la jerarquía por slugs. */
export const categorySchema = z.object({ slug: z.string(), name: z.string(), path: z.string() })
export type Category = z.infer<typeof categorySchema>

export const repositorySchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  owner: z.string(),
  name: z.string(),
  url: z.url(),
  description: z.string().nullable(),
  homepage: z.string().nullable(),
  primaryLanguage: z.string().nullable(),
  license: z.string().nullable(),
  topics: z.array(z.string()),
  stars: z.number().int(),
  forks: z.number().int(),
  openIssues: z.number().int(),
  archived: z.boolean(),
  defaultBranch: z.string().nullable(),
  latestRelease: z.string().nullable(),
  githubCreatedAt: z.iso.datetime().nullable(),
  githubUpdatedAt: z.iso.datetime().nullable(),
  githubPushedAt: z.iso.datetime().nullable(),
  latestReleaseAt: z.iso.datetime().nullable(),
  metadataRefreshedAt: z.iso.datetime(),
  analysis: analysisSchema,
  categories: z.array(categorySchema),
})
export type Repository = z.infer<typeof repositorySchema>

export const personalSchema = z.object({
  status: z.enum(PERSONAL_STATUSES),
  favorite: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  savedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
})
export type Personal = z.infer<typeof personalSchema>

export const userRepositorySchema = z.object({
  id: z.uuid(),
  repository: repositorySchema,
  personal: personalSchema,
})
export type UserRepository = z.infer<typeof userRepositorySchema>

/** El detalle añade lo pesado: README en Markdown crudo y lenguajes por bytes. */
export const userRepositoryDetailSchema = z.object({
  id: z.uuid(),
  repository: repositorySchema.extend({
    readme: z.string().nullable(),
    languages: z.record(z.string(), z.number().int()),
  }),
  personal: personalSchema,
})
export type UserRepositoryDetail = z.infer<typeof userRepositoryDetailSchema>

export const listMetaSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})
export type ListMeta = z.infer<typeof listMetaSchema>

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

/**
 * Los parámetros de la lista. `strict`: un parámetro que no está aquí es 422,
 * no se ignora (specs/library · «Lista con orden y filtros»). `category` es el
 * slug de una categoría del catálogo y filtra por su rama entera: `databases`
 * incluye `vector`. Un slug con forma válida que el catálogo no conoce también
 * es 422, pero eso lo decide el servicio, que es quien lee el catálogo (H-08).
 */
export const libraryQuerySchema = z
  .object({
    status: z.enum(PERSONAL_STATUSES).optional(),
    favorite: booleanParam,
    category: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,60}$/, 'No es el slug de una categoría')
      .optional(),
    language: z.string().trim().min(1).max(60).optional(),
    license: z.string().trim().min(1).max(60).optional(),
    minStars: z.coerce.number().int().min(0).optional(),
    sort: z.enum(LIBRARY_SORTS).default('savedAt'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict()
export type LibraryQuery = z.infer<typeof libraryQuerySchema>

/**
 * Pedir el análisis de un repositorio de mi biblioteca: reintentar uno que
 * falló, o con `force` rehacer uno vigente (specs/ai · «Un análisis por
 * repositorio»). `strict`: un campo desconocido es 422.
 */
export const analysisRequestSchema = z.object({ force: z.boolean().optional() }).strict()
export type AnalysisRequestBody = z.infer<typeof analysisRequestSchema>

/**
 * Dónde busca la búsqueda (specs/search · «Ámbitos y privacidad»): `library`,
 * mi biblioteca con mis datos; `global`, el corpus de repositorios conocidos,
 * sin datos personales de nadie.
 */
export const SEARCH_SCOPES = ['library', 'global'] as const
export type SearchScopeName = (typeof SEARCH_SCOPES)[number]

/** Los campos del documento léxico de un repositorio, que la explicación nombra. */
export const SEARCH_FIELDS = [
  'name',
  'description',
  'topics',
  'categories',
  'summary',
  'purpose',
  'useCases',
  'tags',
] as const
export type SearchField = (typeof SEARCH_FIELDS)[number]

/** `hybrid`: léxica y semántica fusionadas. `lexical`: sin embedding de la consulta (IA apagada o caída). */
export const SEARCH_MODES = ['hybrid', 'lexical'] as const

const LIBRARY_ONLY = 'Solo filtra en tu biblioteca: usa scope=library'

/**
 * Los parámetros de la búsqueda. `strict`, como la lista: un parámetro que no
 * está aquí es 422. `license` admite varias separadas por comas
 * («MIT,Apache-2.0») y cualquiera de ellas vale (specs/search ·
 * «Combinación»). `status` y `favorite` son datos personales y solo filtran
 * en `library`: en `global` no filtrarían nada, y un filtro que no filtra no
 * se acepta (H-08). Una categoría con forma válida que el catálogo no conoce
 * es 422 también, pero eso lo decide el servicio, que lee el catálogo.
 */
export const searchQuerySchema = z
  .object({
    q: z.string().trim().min(2, 'Escribe al menos dos caracteres').max(200),
    scope: z.enum(SEARCH_SCOPES).default('library'),
    category: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,60}$/, 'No es el slug de una categoría')
      .optional(),
    language: z.string().trim().min(1).max(60).optional(),
    license: z
      .string()
      .trim()
      .regex(/^[^,]{1,60}(,[^,]{1,60}){0,9}$/, 'Hasta diez licencias separadas por comas')
      .transform((v) => [...new Set(v.split(',').map((l) => l.trim()))].filter(Boolean))
      .optional(),
    minStars: z.coerce.number().int().min(0).optional(),
    status: z.enum(PERSONAL_STATUSES).optional(),
    favorite: booleanParam,
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.scope !== 'global') return
    for (const field of ['status', 'favorite'] as const) {
      if (v[field] !== undefined)
        ctx.addIssue({ code: 'custom', path: [field], message: LIBRARY_ONLY })
    }
  })
export type SearchQuery = z.infer<typeof searchQuerySchema>

/**
 * Un resultado de búsqueda. `repository` es el repositorio global con su
 * análisis y sus categorías. `id` y `personal` son **mi** relación con él, y
 * los dos son null si no está en mi biblioteca: nunca traen datos de otra
 * cuenta ni dicen quién más lo guardó (specs/search · «Buscar en el corpus
 * global»). `match` explica por qué aparece: los campos y las palabras en que
 * coincide, si se parece por significado, y el «Por qué» en una línea.
 */
export const searchResultSchema = z.object({
  id: z.uuid().nullable(),
  repository: repositorySchema,
  personal: personalSchema.nullable(),
  match: z.object({
    fields: z.array(z.enum(SEARCH_FIELDS)),
    terms: z.array(z.string()),
    semantic: z.boolean(),
    reason: z.string(),
  }),
})
export type SearchResult = z.infer<typeof searchResultSchema>

export const searchMetaSchema = z.object({
  scope: z.enum(SEARCH_SCOPES),
  mode: z.enum(SEARCH_MODES),
  total: z.number().int(),
})
export type SearchMeta = z.infer<typeof searchMetaSchema>

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
