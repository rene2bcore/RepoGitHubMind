import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
