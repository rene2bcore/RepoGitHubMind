import { and, asc, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm'
import { abandonmentAssessment, analysisStaleReason } from '@rgm/ai'
import {
  categories,
  enqueueJob,
  getDb,
  repositories,
  repositoryAnalyses,
  repositoryCategories,
  repositoryTags,
  tags,
  userRepositories,
  type Database,
} from '@rgm/db'
import { getGitHubProvider, type GitHubRepositoryData } from '@rgm/github'
import {
  NotFoundError,
  ValidationError,
  parseGitHubUrl,
  readEnv,
  type AnalysisRequestBody,
  type Category,
  type LibraryQuery,
  type ListMeta,
  type PersonalUpdateBody,
  type SaveRepositoryBody,
  type UserRepository,
  type UserRepositoryDetail,
} from '@rgm/shared'

/**
 * specs/repositories · «Una URL en cualquier variante», «Un repositorio
 * existe una sola vez», «Metadata de GitHub al guardar», «Guardar responde
 * antes que la IA».
 *
 * `Repository` es global y se pide a GitHub **una** vez por repositorio
 * (ADR-0008): la segunda cuenta que lo guarda solo crea su relación privada.
 * La respuesta lleva la metadata ya presente; el análisis lo hace el worker
 * desde la cola (ADR-0010) y se pide solo si el guardado no lo tiene vigente
 * (specs/ai · «Un análisis por repositorio»). Guardar nunca espera a la IA.
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
  await requestAnalysis(db, repositoryId, false)

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
  return row.id
}

/**
 * Pide el análisis de un repositorio global si hace falta (ADR-0009): con la
 * IA apagada, `DISABLED` y nada en cola; con un análisis vigente y sin
 * forzar, nada; si no, `ANALYZE_REPOSITORY` en la cola, que es idempotente.
 * Un análisis completado sigue `COMPLETED` mientras llega el nuevo: el
 * anterior se conserva hasta que termine (specs/ai · «Repositorio que
 * cambió»).
 *
 * Forzar caduca el análisis vigente antes de encolar. La cola admite un solo
 * trabajo activo por repositorio, así que si ya hay uno en cola o en curso no
 * se encola otro: ese trabajo vuelve a mirar la caché, la encuentra caducada
 * y rehace el análisis. Sin caducarlo, un trabajo ya tomado por el worker
 * respondería «vigente» y el forzado se perdería en silencio.
 *
 * @returns si al terminar hay un análisis en camino.
 */
async function requestAnalysis(
  db: Database,
  repositoryId: string,
  force: boolean,
): Promise<boolean> {
  if (!readEnv().AI_ANALYSIS_ENABLED) {
    await db
      .insert(repositoryAnalyses)
      .values({ repositoryId, status: 'DISABLED' })
      .onConflictDoNothing()
    return false
  }
  const [row] = await db
    .select({
      githubPushedAt: repositories.githubPushedAt,
      status: repositoryAnalyses.status,
      aiAnalyzedAt: repositoryAnalyses.aiAnalyzedAt,
      expiresAt: repositoryAnalyses.expiresAt,
    })
    .from(repositories)
    .leftJoin(repositoryAnalyses, eq(repositoryAnalyses.repositoryId, repositories.id))
    .where(eq(repositories.id, repositoryId))
    .limit(1)
  const cached = row?.status
    ? { status: row.status, aiAnalyzedAt: row.aiAnalyzedAt, expiresAt: row.expiresAt }
    : null
  if (!analysisStaleReason(cached, { githubPushedAt: row?.githubPushedAt ?? null }, { force })) {
    return false
  }

  const now = new Date()
  await db
    .insert(repositoryAnalyses)
    .values({ repositoryId, status: 'PENDING' })
    .onConflictDoUpdate({
      target: repositoryAnalyses.repositoryId,
      set: {
        status: sql`case when ${repositoryAnalyses.status} = 'COMPLETED' then 'COMPLETED' else 'PENDING' end`,
        ...(force ? { expiresAt: now } : {}),
        updatedAt: now,
      },
    })
  await enqueueJob('ANALYZE_REPOSITORY', repositoryId, force ? { force: true } : {}, db)
  return true
}

/**
 * specs/ai · «La IA nunca impide guardar» (reintentar) y «Un análisis por
 * repositorio» (forzar), sobre un repositorio de **mi** biblioteca. Un id de
 * otra cuenta es 404, igual que uno que no existe. El análisis es del
 * repositorio global: lo que se pide aquí lo verán todas las cuentas que lo
 * tengan, y nadie sabrá quién lo pidió.
 *
 * @returns `enqueued: false` si no hacía falta (vigente y sin forzar) o si la
 *   IA está apagada.
 */
export async function requestRepositoryAnalysis(
  userId: string,
  id: string,
  body: AnalysisRequestBody,
): Promise<{ item: UserRepository; enqueued: boolean }> {
  const db = getDb()
  const [relation] = await db
    .select({ repositoryId: userRepositories.repositoryId })
    .from(userRepositories)
    .where(and(eq(userRepositories.userId, userId), eq(userRepositories.id, id)))
    .limit(1)
  if (!relation) throw new NotFoundError()
  const enqueued = await requestAnalysis(db, relation.repositoryId, body.force === true)
  const item = await getUserRepository(userId, { id })
  if (!item) throw new NotFoundError()
  return { item, enqueued }
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
    installationSummary: repositoryAnalyses.installationSummary,
    deploymentType: repositoryAnalyses.deploymentType,
    frameworks: repositoryAnalyses.frameworks,
    maturity: repositoryAnalyses.maturity,
    advantages: repositoryAnalyses.advantages,
    limitations: repositoryAnalyses.limitations,
    targetUsers: repositoryAnalyses.targetUsers,
    activityAssessment: repositoryAnalyses.activityAssessment,
    abandonmentRisk: repositoryAnalyses.abandonmentRisk,
    aiAnalyzedAt: repositoryAnalyses.aiAnalyzedAt,
  },
}

type Analysis = UserRepository['repository']['analysis']
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
  // Con left join, cada columna puede venir null aunque en la tabla no lo sea.
  analysis: {
    status: Analysis['status'] | null
    summary: string | null
    purpose: string | null
    mainUseCases: string[] | null
    installationSummary: string | null
    deploymentType: string[] | null
    frameworks: string[] | null
    maturity: string | null
    advantages: string[] | null
    limitations: string[] | null
    targetUsers: string[] | null
    activityAssessment: string | null
    abandonmentRisk: Analysis['abandonmentRisk'] | null
    aiAnalyzedAt: Date | null
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)

function toItem(row: Row, categoryList: Category[], tagList: string[]): UserRepository {
  const a = row.analysis
  const status = a.status ?? 'PENDING'
  const risk = abandonmentAssessment(
    { archived: row.repository.archived, githubPushedAt: row.repository.githubPushedAt },
    status === 'COMPLETED' ? a.abandonmentRisk : null,
  )
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
        status,
        summary: a.summary,
        purpose: a.purpose,
        mainUseCases: a.mainUseCases ?? [],
        installationSummary: a.installationSummary,
        deploymentType: a.deploymentType ?? [],
        frameworks: a.frameworks ?? [],
        maturity: a.maturity,
        advantages: a.advantages ?? [],
        limitations: a.limitations ?? [],
        targetUsers: a.targetUsers ?? [],
        activityAssessment: a.activityAssessment,
        tags: tagList,
        abandonmentRisk: risk.risk,
        abandonmentRiskSource: risk.source,
        aiAnalyzedAt: iso(a.aiAnalyzedAt),
      },
      categories: categoryList,
    },
    personal: {
      ...row.personal,
      savedAt: row.personal.savedAt.toISOString(),
      reviewedAt: iso(row.personal.reviewedAt),
      updatedAt: row.personal.updatedAt.toISOString(),
    },
  }
}

/** Filas a items, con las categorías y los tags de IA de cada repositorio en dos consultas. */
async function toItems(db: Database, rows: Row[]): Promise<UserRepository[]> {
  const ids = [...new Set(rows.map((r) => r.repository.id))]
  if (!ids.length) return []
  const [categoryRows, tagRows] = await Promise.all([
    db
      .select({
        repositoryId: repositoryCategories.repositoryId,
        slug: categories.slug,
        name: categories.name,
        path: categories.path,
      })
      .from(repositoryCategories)
      .innerJoin(categories, eq(categories.id, repositoryCategories.categoryId))
      .where(inArray(repositoryCategories.repositoryId, ids))
      .orderBy(categories.path),
    db
      .select({ repositoryId: repositoryTags.repositoryId, slug: tags.slug })
      .from(repositoryTags)
      .innerJoin(tags, eq(tags.id, repositoryTags.tagId))
      .where(and(inArray(repositoryTags.repositoryId, ids), eq(tags.kind, 'AI')))
      .orderBy(tags.slug),
  ])
  return rows.map((row) =>
    toItem(
      row,
      categoryRows
        .filter((c) => c.repositoryId === row.repository.id)
        .map(({ slug, name, path }) => ({ slug, name, path })),
      tagRows.filter((t) => t.repositoryId === row.repository.id).map((t) => t.slug),
    ),
  )
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
  const db = getDb()
  const rows = await baseQuery(db).where(where).limit(1)
  const [item] = await toItems(db, rows as Row[])
  return item ?? null
}

/**
 * specs/library · «Detalle de un repositorio» y «Id de otra cuenta»: el
 * detalle de **mi** relación, con el README crudo y los lenguajes. Un id que
 * no es mío responde 404 exactamente igual que uno que no existe.
 */
export async function getUserRepositoryDetail(
  userId: string,
  id: string,
): Promise<UserRepositoryDetail> {
  const item = await getUserRepository(userId, { id })
  if (!item) throw new NotFoundError()
  const [extra] = await getDb()
    .select({ readme: repositories.readme, languages: repositories.languages })
    .from(repositories)
    .where(eq(repositories.id, item.repository.id))
    .limit(1)
  return {
    ...item,
    repository: {
      ...item.repository,
      readme: extra?.readme ?? null,
      languages: extra?.languages ?? {},
    },
  }
}

/**
 * specs/library · «Estado personal con nueve valores fijos», «Rating y
 * notas», «Favorito y estado independientes». El cuerpo llega validado por
 * `personalUpdateSchema` antes de resolver el id (ADR-0005). Pasar a
 * `REVIEWED` fija `reviewedAt`; volver a otro estado no lo borra. La
 * respuesta se relee de la base, no se devuelve lo enviado.
 */
export async function updatePersonal(
  userId: string,
  id: string,
  body: PersonalUpdateBody,
): Promise<UserRepository> {
  const set: Partial<typeof userRepositories.$inferInsert> = { updatedAt: new Date() }
  if (body.status !== undefined) {
    set.status = body.status
    if (body.status === 'REVIEWED') set.reviewedAt = new Date()
  }
  if (body.favorite !== undefined) set.favorite = body.favorite
  if (body.rating !== undefined) set.rating = body.rating
  if (body.notes !== undefined) set.notes = body.notes

  const updated = await getDb()
    .update(userRepositories)
    .set(set)
    .where(and(eq(userRepositories.userId, userId), eq(userRepositories.id, id)))
    .returning({ id: userRepositories.id })
  if (!updated.length) throw new NotFoundError()
  const item = await getUserRepository(userId, { id })
  if (!item) throw new NotFoundError()
  return item
}

const sortColumn = {
  savedAt: userRepositories.savedAt,
  pushedAt: repositories.githubPushedAt,
  stars: repositories.stars,
  name: repositories.fullName,
  rating: userRepositories.rating,
} as const

export const UNKNOWN_CATEGORY = {
  field: 'category',
  rule: 'category',
  message: 'No es una categoría del catálogo',
} as const

/**
 * specs/library · «Lista con orden y filtros» y «Biblioteca vacía». Solo las
 * relaciones de la cuenta con sesión. Los valores de orden y filtro ya
 * vienen validados por `libraryQuerySchema`: un valor fuera del dominio es un
 * 422 antes de llegar aquí (ADR-0005), y un parámetro desconocido también.
 * `category` filtra por la rama entera del catálogo, y un slug que el
 * catálogo no conoce es 422 sobre `category`, no una lista vacía (H-08).
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
  if (query.category) {
    const [category] = await db
      .select({ path: categories.path })
      .from(categories)
      .where(eq(categories.slug, query.category))
      .limit(1)
    if (!category) throw new ValidationError([UNKNOWN_CATEGORY])
    conditions.push(sql`exists (
      select 1 from ${repositoryCategories}
      inner join ${categories} on ${categories.id} = ${repositoryCategories.categoryId}
      where ${repositoryCategories.repositoryId} = ${repositories.id}
        and (${categories.path} = ${category.path} or ${categories.path} like ${`${category.path}/%`})
    )`)
  }
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
    items: await toItems(db, rows as Row[]),
    meta: { total: count?.total ?? 0, page: query.page, pageSize: query.pageSize },
  }
}

/**
 * Las categorías que aparecen en **mi** biblioteca, con sus antecesoras para
 * poder filtrar por rama, ordenadas por jerarquía. Es lo que ofrece el filtro
 * de la pantalla: una lista de setenta categorías vacías no ayuda a nadie.
 */
export async function listLibraryCategories(userId: string): Promise<Category[]> {
  const db = getDb()
  const used = await db
    .selectDistinct({ path: categories.path })
    .from(repositoryCategories)
    .innerJoin(categories, eq(categories.id, repositoryCategories.categoryId))
    .innerJoin(
      userRepositories,
      eq(userRepositories.repositoryId, repositoryCategories.repositoryId),
    )
    .where(eq(userRepositories.userId, userId))
  if (!used.length) return []
  const paths = new Set(
    used.flatMap(({ path }) =>
      path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/')),
    ),
  )
  return db
    .select({ slug: categories.slug, name: categories.name, path: categories.path })
    .from(categories)
    .where(inArray(categories.path, [...paths]))
    .orderBy(categories.path)
}
