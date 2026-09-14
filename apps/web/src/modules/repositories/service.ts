import { and, asc, desc, eq, gte, sql, type SQL } from 'drizzle-orm'
import {
  enqueueJob,
  getDb,
  repositories,
  repositoryAnalyses,
  userRepositories,
  type Database,
} from '@rgm/db'
import { getGitHubProvider, type GitHubRepositoryData } from '@rgm/github'
import {
  parseGitHubUrl,
  readEnv,
  type LibraryQuery,
  type ListMeta,
  type SaveRepositoryBody,
  type UserRepository,
} from '@rgm/shared'

/**
 * specs/repositories · «Una URL en cualquier variante», «Un repositorio
 * existe una sola vez», «Metadata de GitHub al guardar», «Guardar responde
 * antes que la IA».
 *
 * `Repository` es global y se pide a GitHub **una** vez por repositorio
 * (ADR-0008): la segunda cuenta que lo guarda solo crea su relación privada.
 * La respuesta lleva la metadata ya presente y el análisis `PENDING`; el
 * análisis lo hace el worker desde la cola (ADR-0010). Si la IA está
 * apagada, el análisis nace `DISABLED` y no se encola nada.
 *
 * @returns `created: false` cuando ya estaba en la biblioteca de la cuenta
 *   (specs/repositories · «Ya está en mi biblioteca»): responde 200, no 201.
 */
export async function saveRepository(
  userId: string,
  body: SaveRepositoryBody,
): Promise<{ item: UserRepository; created: boolean }> {
  const ref = parseGitHubUrl(body.url)
  const db = getDb()

  let repositoryId = await findRepositoryId(db, ref.fullName)
  if (!repositoryId) {
    const data = await getGitHubProvider().fetchRepository(ref.owner, ref.name)
    repositoryId = await upsertRepository(db, data)
  }

  const inserted = await db
    .insert(userRepositories)
    .values({ userId, repositoryId, source: body.source ?? null, sourceText: body.url })
    .onConflictDoNothing()
    .returning({ id: userRepositories.id })

  const item = await getUserRepository(userId, { repositoryId })
  if (!item) throw new Error('la relación recién guardada no se pudo leer')
  return { item, created: inserted.length > 0 }
}

async function findRepositoryId(db: Database, fullName: string): Promise<string | null> {
  const [row] = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(eq(repositories.fullName, fullName))
    .limit(1)
  return row?.id ?? null
}

/**
 * Inserta o refresca por el id de GitHub, que es el identificador estable:
 * un repositorio renombrado sigue siendo el mismo. La carrera de dos cuentas
 * guardando lo mismo a la vez la resuelve el índice único, no el código.
 */
async function upsertRepository(db: Database, data: GitHubRepositoryData): Promise<string> {
  const now = new Date()
  const values = { ...data, metadataRefreshedAt: now }
  const { githubRepositoryId, ...refresh } = values
  const [row] = await db
    .insert(repositories)
    .values(values)
    .onConflictDoUpdate({
      target: repositories.githubRepositoryId,
      set: { ...refresh, updatedAt: now },
    })
    .returning({ id: repositories.id })
  if (!row) throw new Error('el alta del repositorio no devolvió la fila')

  const aiEnabled = readEnv().AI_ANALYSIS_ENABLED
  await db
    .insert(repositoryAnalyses)
    .values({ repositoryId: row.id, status: aiEnabled ? 'PENDING' : 'DISABLED' })
    .onConflictDoNothing()
  if (aiEnabled) await enqueueJob('ANALYZE_REPOSITORY', row.id)
  return row.id
}

const itemColumns = {
  id: userRepositories.id,
  personal: {
    status: userRepositories.status,
    favorite: userRepositories.favorite,
    rating: userRepositories.rating,
    notes: userRepositories.notes,
    savedAt: userRepositories.savedAt,
    reviewedAt: userRepositories.reviewedAt,
    updatedAt: userRepositories.updatedAt,
  },
  repository: {
    id: repositories.id,
    fullName: repositories.fullName,
    owner: repositories.owner,
    name: repositories.name,
    url: repositories.url,
    description: repositories.description,
    homepage: repositories.homepage,
    primaryLanguage: repositories.primaryLanguage,
    license: repositories.license,
    topics: repositories.topics,
    stars: repositories.stars,
    forks: repositories.forks,
    openIssues: repositories.openIssues,
    archived: repositories.archived,
    defaultBranch: repositories.defaultBranch,
    latestRelease: repositories.latestRelease,
    githubCreatedAt: repositories.githubCreatedAt,
    githubUpdatedAt: repositories.githubUpdatedAt,
    githubPushedAt: repositories.githubPushedAt,
    latestReleaseAt: repositories.latestReleaseAt,
    metadataRefreshedAt: repositories.metadataRefreshedAt,
  },
  analysis: {
    status: repositoryAnalyses.status,
    summary: repositoryAnalyses.summary,
    purpose: repositoryAnalyses.purpose,
    mainUseCases: repositoryAnalyses.mainUseCases,
    abandonmentRisk: repositoryAnalyses.abandonmentRisk,
    aiAnalyzedAt: repositoryAnalyses.aiAnalyzedAt,
  },
}

type Row = {
  id: string
  personal: {
    status: UserRepository['personal']['status']
    favorite: boolean
    rating: number | null
    notes: string | null
    savedAt: Date
    reviewedAt: Date | null
    updatedAt: Date
  }
  repository: Omit<
    UserRepository['repository'],
    | 'analysis'
    | 'categories'
    | 'githubCreatedAt'
    | 'githubUpdatedAt'
    | 'githubPushedAt'
    | 'latestReleaseAt'
    | 'metadataRefreshedAt'
  > & {
    githubCreatedAt: Date | null
    githubUpdatedAt: Date | null
    githubPushedAt: Date | null
    latestReleaseAt: Date | null
    metadataRefreshedAt: Date
  }
  analysis: {
    status: UserRepository['repository']['analysis']['status'] | null
    summary: string | null
    purpose: string | null
    mainUseCases: string[] | null
    abandonmentRisk: UserRepository['repository']['analysis']['abandonmentRisk'] | null
    aiAnalyzedAt: Date | null
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)

function toItem(row: Row): UserRepository {
  return {
    id: row.id,
    repository: {
      ...row.repository,
      githubCreatedAt: iso(row.repository.githubCreatedAt),
      githubUpdatedAt: iso(row.repository.githubUpdatedAt),
      githubPushedAt: iso(row.repository.githubPushedAt),
      latestReleaseAt: iso(row.repository.latestReleaseAt),
      metadataRefreshedAt: row.repository.metadataRefreshedAt.toISOString(),
      analysis: {
        status: row.analysis.status ?? 'PENDING',
        summary: row.analysis.summary,
        purpose: row.analysis.purpose,
        mainUseCases: row.analysis.mainUseCases ?? [],
        abandonmentRisk: row.analysis.abandonmentRisk,
        aiAnalyzedAt: iso(row.analysis.aiAnalyzedAt),
      },
      // Las categorías llegan con H4 (RGM-5): hasta entonces, ninguna.
      categories: [],
    },
    personal: {
      ...row.personal,
      savedAt: row.personal.savedAt.toISOString(),
      reviewedAt: iso(row.personal.reviewedAt),
      updatedAt: row.personal.updatedAt.toISOString(),
    },
  }
}

function baseQuery(db: Database) {
  return db
    .select(itemColumns)
    .from(userRepositories)
    .innerJoin(repositories, eq(repositories.id, userRepositories.repositoryId))
    .leftJoin(repositoryAnalyses, eq(repositoryAnalyses.repositoryId, repositories.id))
}

/**
 * Una relación de **esta** cuenta, por su id o por el repositorio. Toda
 * consulta filtra por el `userId` de la sesión (ADR-0008): el id de otra
 * cuenta no existe desde aquí.
 */
export async function getUserRepository(
  userId: string,
  by: { id: string } | { repositoryId: string },
): Promise<UserRepository | null> {
  const where =
    'id' in by
      ? and(eq(userRepositories.userId, userId), eq(userRepositories.id, by.id))
      : and(eq(userRepositories.userId, userId), eq(userRepositories.repositoryId, by.repositoryId))
  const [row] = await baseQuery(getDb()).where(where).limit(1)
  return row ? toItem(row as Row) : null
}

const sortColumn = {
  savedAt: userRepositories.savedAt,
  pushedAt: repositories.githubPushedAt,
  stars: repositories.stars,
  name: repositories.fullName,
  rating: userRepositories.rating,
} as const

/**
 * specs/library · «Lista con orden y filtros» y «Biblioteca vacía». Solo las
 * relaciones de la cuenta con sesión. Los valores de orden y filtro ya
 * vienen validados por `libraryQuerySchema`: un valor fuera del dominio es un
 * 422 antes de llegar aquí (ADR-0005). El filtro por categoría entra con H4.
 */
export async function listUserRepositories(
  userId: string,
  query: LibraryQuery,
): Promise<{ items: UserRepository[]; meta: ListMeta }> {
  const db = getDb()
  const conditions: SQL[] = [eq(userRepositories.userId, userId)]
  if (query.status) conditions.push(eq(userRepositories.status, query.status))
  if (query.favorite !== undefined) conditions.push(eq(userRepositories.favorite, query.favorite))
  if (query.language)
    conditions.push(sql`lower(${repositories.primaryLanguage}) = ${query.language.toLowerCase()}`)
  if (query.license)
    conditions.push(sql`lower(${repositories.license}) = ${query.license.toLowerCase()}`)
  if (query.minStars !== undefined) conditions.push(gte(repositories.stars, query.minStars))
  const where = and(...conditions)

  const column = sortColumn[query.sort]
  const order = query.sort === 'name' ? asc(column) : sql`${column} desc nulls last`

  const [rows, [count]] = await Promise.all([
    baseQuery(db)
      .where(where)
      .orderBy(order, desc(userRepositories.savedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(userRepositories)
      .innerJoin(repositories, eq(repositories.id, userRepositories.repositoryId))
      .where(where),
  ])
  return {
    items: (rows as Row[]).map(toItem),
    meta: { total: count?.total ?? 0, page: query.page, pageSize: query.pageSize },
  }
}
