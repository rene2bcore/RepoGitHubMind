import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

/**
 * Esquema de H1 · cuentas y sesiones (docs/data-model.md).
 *
 * `users.email` se guarda en minúsculas y además lleva un índice único sobre
 * `lower(email)`: la misma persona no puede registrarse dos veces con otras
 * mayúsculas aunque alguna ruta futura olvide normalizar.
 *
 * `sessions` guarda tokens opacos: cerrar sesión borra la fila y la cookie
 * deja de valer al momento (specs/auth · «Salir»). Ver ADR-0013.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['USER', 'ADMIN'] })
      .notNull()
      .default('USER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_lower_unique').on(sql`lower(${t.email})`)],
)

export const sessions = pgTable(
  'sessions',
  {
    token: text('token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
)

/**
 * Tablas que el adaptador de Auth.js necesitará cuando lleguen GitHub OAuth y
 * Google (R2). Se crean ahora para no migrar dos veces; en R1 no se usan.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('accounts_provider_unique').on(t.provider, t.providerAccountId)],
)

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').primaryKey(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
})

// ---------------------------------------------------------------------------
// H2 · repositorios globales, relación privada por cuenta, análisis y cola
// (docs/data-model.md, ADR-0008, ADR-0010)
// ---------------------------------------------------------------------------

export const PERSONAL_STATUS_VALUES = [
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

export const ANALYSIS_STATUS_VALUES = ['PENDING', 'COMPLETED', 'FAILED', 'DISABLED'] as const

export const JOB_TYPE_VALUES = [
  'IMPORT_REPOSITORY',
  'ANALYZE_REPOSITORY',
  'GENERATE_EMBEDDING',
  'REFRESH_REPOSITORY',
  'BULK_IMPORT',
] as const

export const JOB_STATUS_VALUES = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'] as const

const textArray = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'::text[]`)

/**
 * `Repository` es global: una fila por repositorio de GitHub aunque lo
 * guarden mil cuentas (ADR-0008). El identificador estable es el id de
 * GitHub; `full_name` va en minúsculas porque GitHub no distingue mayúsculas.
 */
export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    githubRepositoryId: bigint('github_repository_id', { mode: 'number' }).notNull(),
    fullName: text('full_name').notNull(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    description: text('description'),
    homepage: text('homepage'),
    primaryLanguage: text('primary_language'),
    license: text('license'),
    topics: textArray('topics'),
    languages: jsonb('languages').$type<Record<string, number>>().notNull().default({}),
    stars: integer('stars').notNull().default(0),
    forks: integer('forks').notNull().default(0),
    openIssues: integer('open_issues').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
    fork: boolean('fork').notNull().default(false),
    defaultBranch: text('default_branch'),
    readme: text('readme'),
    latestRelease: text('latest_release'),
    githubCreatedAt: timestamp('github_created_at', { withTimezone: true }),
    githubUpdatedAt: timestamp('github_updated_at', { withTimezone: true }),
    githubPushedAt: timestamp('github_pushed_at', { withTimezone: true }),
    latestReleaseAt: timestamp('latest_release_at', { withTimezone: true }),
    metadataRefreshedAt: timestamp('metadata_refreshed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('repositories_github_id_unique').on(t.githubRepositoryId),
    uniqueIndex('repositories_full_name_unique').on(t.fullName),
    index('repositories_pushed_at_idx').on(t.githubPushedAt),
    index('repositories_stars_idx').on(t.stars),
    index('repositories_language_idx').on(t.primaryLanguage),
    index('repositories_license_idx').on(t.license),
  ],
)

/** Un análisis vigente por repositorio, reutilizado por todas las cuentas (ADR-0009). */
export const repositoryAnalyses = pgTable('repository_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id')
    .notNull()
    .unique()
    .references(() => repositories.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ANALYSIS_STATUS_VALUES }).notNull().default('PENDING'),
  summary: text('summary'),
  purpose: text('purpose'),
  mainUseCases: textArray('main_use_cases'),
  installationSummary: text('installation_summary'),
  deploymentType: textArray('deployment_type'),
  frameworks: textArray('frameworks'),
  maturity: text('maturity'),
  advantages: textArray('advantages'),
  limitations: textArray('limitations'),
  targetUsers: textArray('target_users'),
  activityAssessment: text('activity_assessment'),
  abandonmentRisk: text('abandonment_risk', { enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] }),
  aiConfidence: real('ai_confidence'),
  provider: text('provider'),
  model: text('model'),
  lastError: text('last_error'),
  aiAnalyzedAt: timestamp('ai_analyzed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * `UserRepository` es privada: estado, favorito, rating y notas de una cuenta
 * sobre un repositorio global. Nunca salen a otra cuenta (ADR-0008). Toda
 * consulta filtra por el `user_id` de la sesión.
 */
export const userRepositories = pgTable(
  'user_repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    status: text('status', { enum: PERSONAL_STATUS_VALUES }).notNull().default('NEW'),
    favorite: boolean('favorite').notNull().default(false),
    rating: smallint('rating'),
    notes: text('notes'),
    source: text('source'),
    sourceText: text('source_text'),
    customTitle: text('custom_title'),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_repositories_user_repo_unique').on(t.userId, t.repositoryId),
    index('user_repositories_user_status_idx').on(t.userId, t.status),
    index('user_repositories_user_favorite_idx').on(t.userId, t.favorite),
    index('user_repositories_user_saved_idx').on(t.userId, t.savedAt),
  ],
)

/**
 * Cola de trabajos en PostgreSQL (ADR-0010): tabla propia, tomada con
 * `FOR UPDATE SKIP LOCKED`. El índice único parcial hace idempotente el
 * encolado: un mismo trabajo sobre un mismo repositorio no se repite
 * mientras esté en cola o en curso.
 */
export const backgroundJobs = pgTable(
  'background_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type', { enum: JOB_TYPE_VALUES }).notNull(),
    repositoryId: uuid('repository_id').references(() => repositories.id, {
      onDelete: 'cascade',
    }),
    status: text('status', { enum: JOB_STATUS_VALUES }).notNull().default('QUEUED'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastError: text('last_error'),
    runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('background_jobs_status_run_after_idx').on(t.status, t.runAfter),
    uniqueIndex('background_jobs_active_unique')
      .on(t.type, t.repositoryId)
      .where(sql`${t.status} in ('QUEUED', 'PROCESSING')`),
  ],
)

// ---------------------------------------------------------------------------
// H4 · taxonomía controlada, tags y uso de IA (docs/taxonomy.md, ADR-0009)
// ---------------------------------------------------------------------------

export const CATEGORY_ORIGIN_VALUES = ['AI', 'ADMIN'] as const
export const TAG_KIND_VALUES = ['AI', 'GITHUB_TOPIC'] as const
export const AI_OPERATION_VALUES = ['ANALYSIS', 'EMBEDDING'] as const

/**
 * El catálogo controlado y jerárquico. Lo escribe el seed desde
 * `src/taxonomy.ts`, nunca la IA: una sugerencia que no mapea va a `tags`.
 * `path` son los slugs de la raíz a la hoja y es lo que permite filtrar por
 * una rama entera; `synonyms` alimenta el mapeador.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'restrict',
    }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    depth: integer('depth').notNull(),
    synonyms: textArray('synonyms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categories_slug_unique').on(t.slug),
    uniqueIndex('categories_path_unique').on(t.path),
  ],
)

/**
 * Un repositorio en una categoría. `origin = AI` lo escribe el análisis y se
 * reemplaza al reanalizar; `ADMIN` (roadmap) gana y el análisis no lo toca.
 */
export const repositoryCategories = pgTable(
  'repository_categories',
  {
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    origin: text('origin', { enum: CATEGORY_ORIGIN_VALUES }).notNull(),
    confidence: real('confidence'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.repositoryId, t.categoryId] }),
    index('repository_categories_category_idx').on(t.categoryId),
  ],
)

/** Tags de IA y, más adelante, topics de GitHub: el mismo slug puede ser de los dos tipos. */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    kind: text('kind', { enum: TAG_KIND_VALUES }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tags_kind_slug_unique').on(t.kind, t.slug)],
)

export const repositoryTags = pgTable(
  'repository_tags',
  {
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.repositoryId, t.tagId] }),
    index('repository_tags_tag_idx').on(t.tagId),
  ],
)

/**
 * Una fila por llamada al proveedor, también las que fallan o devuelven una
 * salida que no valida (specs/ai · «Todo uso se registra»). `estimated_cost`
 * es el que declara el proveedor, o null si no lo declara: no se inventa.
 * `unmapped_categories` guarda las sugerencias que el catálogo no conoce,
 * para revisarlo con datos (docs/taxonomy.md). La fila sobrevive al
 * repositorio: el coste ya se pagó.
 */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id').references(() => repositories.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    operation: text('operation', { enum: AI_OPERATION_VALUES }).notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    estimatedCost: numeric('estimated_cost', { precision: 12, scale: 8, mode: 'number' }),
    success: boolean('success').notNull(),
    error: text('error'),
    unmappedCategories: textArray('unmapped_categories'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_usage_repository_idx').on(t.repositoryId),
    index('ai_usage_created_at_idx').on(t.createdAt),
  ],
)
