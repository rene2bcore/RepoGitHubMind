import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { getDb, users } from '@rgm/db'
import {
  AuthorizationError,
  ValidationError,
  type LoginBody,
  type RegisterBody,
  type User,
} from '@rgm/shared'

const EMAIL_TAKEN = {
  field: 'email',
  rule: 'unique',
  message: 'Ya existe una cuenta con ese email',
} as const

function toUser(row: { id: string; email: string; role: 'USER' | 'ADMIN'; createdAt: Date }): User {
  return { id: row.id, email: row.email, role: row.role, createdAt: row.createdAt.toISOString() }
}

/**
 * specs/auth · «Registro de una cuenta nueva» y «Un email, una sola cuenta,
 * ignorando mayúsculas». El email llega ya en minúsculas del esquema; el
 * índice único sobre `lower(email)` es la garantía de verdad, y su violación
 * se traduce a la forma de error del proyecto: una carrera de altas responde
 * 422, no 500.
 */
export async function registerUser(body: RegisterBody): Promise<User> {
  const db = getDb()
  const passwordHash = await bcrypt.hash(body.password, 10)
  try {
    const [row] = await db
      .insert(users)
      .values({ email: body.email, passwordHash })
      .returning({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
    if (!row) throw new Error('el alta no devolvió la fila')
    return toUser(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw new ValidationError([EMAIL_TAKEN])
    throw error
  }
}

/**
 * specs/auth · «Un fallo no revela si la cuenta existe»: email desconocido y
 * contraseña equivocada responden exactamente igual, y se compara siempre
 * contra un hash para que el tiempo tampoco lo revele.
 */
export async function authenticate(body: LoginBody): Promise<User> {
  const [row] = await getDb()
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${body.email}`)
    .limit(1)
  const hash = row?.passwordHash ?? DUMMY_HASH
  const valid = await bcrypt.compare(body.password, hash)
  if (!row || !valid) throw new AuthorizationError('Email o contraseña incorrectos')
  return toUser(row)
}

// Un hash real de una contraseña que nadie tiene, para que el `compare` cueste
// lo mismo exista o no la cuenta.
const DUMMY_HASH = bcrypt.hashSync('nadie-tiene-esta-contraseña', 10)

// Drizzle envuelve el error del driver en `DrizzleQueryError.cause`; el código
// SQLSTATE puede venir en cualquiera de los dos niveles.
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ((error as { code?: string }).code === '23505') return true
  return isUniqueViolation((error as { cause?: unknown }).cause)
}
