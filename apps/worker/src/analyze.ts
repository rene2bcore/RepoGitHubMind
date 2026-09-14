import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  AIOutputInvalidError,
  AIProviderCallError,
  analysisExpiry,
  analysisStaleReason,
  getAIProvider,
  mapCategories,
  normalizeTerm,
  type AICallUsage,
  type AIProvider,
  type AnalysisOutcome,
  type CatalogCategory,
} from '@rgm/ai'
import { refreshSearchVector } from '@rgm/search'
import {
  aiUsage,
  categories,
  enqueueJob,
  getDb,
  repositories,
  repositoryAnalyses,
  repositoryCategories,
  repositoryTags,
  tags,
  type Database,
  type Job,
} from '@rgm/db'
import { readEnv } from '@rgm/shared'

type Repository = typeof repositories.$inferSelect

export type AnalysisJobResult = 'disabled' | 'cached' | 'analyzed' | 'missing'

/**
 * `ANALYZE_REPOSITORY` (specs/ai). Idempotente: repetir el trabajo sobre un
 * análisis vigente no llama al proveedor.
 *
 * - Con `AI_ANALYSIS_ENABLED=false`, el análisis queda `DISABLED` sin
 *   llamadas ni coste; uno ya completado se conserva.
 * - Con un análisis vigente y sin `payload.force`, no hace nada: la caché de
 *   ADR-0009 se comprueba también aquí, no solo al encolar.
 * - Si el proveedor responde, guarda análisis, categorías del catálogo, tags
 *   y una fila de `ai_usage` por llamada, reescribe `search_vector` y encola
 *   `GENERATE_EMBEDDING`, todo en una transacción (specs/search).
 * - Si falla, registra las llamadas y relanza para que la cola decida:
 *   backoff si es reintentable y quedan intentos; si no, el análisis queda
 *   `FAILED` con `last_error`. Un análisis completado anterior se conserva
 *   hasta que otro lo sustituya (specs/ai · «Repositorio que cambió»).
 */
export async function analyzeRepositoryJob(
  job: Job,
  db: Database = getDb(),
): Promise<AnalysisJobResult> {
  const repositoryId = job.repositoryId
  if (!repositoryId) return 'missing'
  const env = readEnv()
  const [row] = await db
    .select({ repository: repositories, analysis: repositoryAnalyses })
    .from(repositories)
    .leftJoin(repositoryAnalyses, eq(repositoryAnalyses.repositoryId, repositories.id))
    .where(eq(repositories.id, repositoryId))
    .limit(1)
  if (!row) return 'missing'

  if (!env.AI_ANALYSIS_ENABLED) {
    await setStatus(db, repositoryId, 'DISABLED', null)
    return 'disabled'
  }
  const force = job.payload.force === true
  if (!analysisStaleReason(row.analysis, row.repository, { force })) return 'cached'

  const provider = getAIProvider()
  const catalog = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      path: categories.path,
      synonyms: categories.synonyms,
    })
    .from(categories)
    .orderBy(categories.path)

  try {
    const outcome = await provider.analyzeRepository({
      repository: toInput(row.repository),
      catalog,
      maxReadmeChars: env.AI_MAX_README_CHARS,
      now: new Date(),
    })
    await saveAnalysis(db, repositoryId, provider, outcome, catalog, env.AI_ANALYSIS_TTL_DAYS)
    return 'analyzed'
  } catch (error) {
    if (error instanceof AIProviderCallError || error instanceof AIOutputInvalidError) {
      await recordUsage(db, repositoryId, provider, error.calls, [])
      if (!error.retryable || job.attempts >= job.maxAttempts) {
        await setStatus(db, repositoryId, 'FAILED', error.message.slice(0, 500))
      }
    }
    throw error
  }
}

function toInput(r: Repository) {
  return {
    fullName: r.fullName,
    description: r.description,
    homepage: r.homepage,
    primaryLanguage: r.primaryLanguage,
    license: r.license,
    topics: r.topics,
    languages: r.languages,
    stars: r.stars,
    forks: r.forks,
    openIssues: r.openIssues,
    archived: r.archived,
    fork: r.fork,
    latestRelease: r.latestRelease,
    latestReleaseAt: r.latestReleaseAt,
    githubCreatedAt: r.githubCreatedAt,
    githubPushedAt: r.githubPushedAt,
    readme: r.readme,
  }
}

/** `DISABLED` o `FAILED`, salvo que ya haya un análisis completado: ese se queda. */
async function setStatus(
  db: Database,
  repositoryId: string,
  status: 'DISABLED' | 'FAILED',
  lastError: string | null,
): Promise<void> {
  const now = new Date()
  await db
    .insert(repositoryAnalyses)
    .values({ repositoryId, status, lastError })
    .onConflictDoUpdate({
      target: repositoryAnalyses.repositoryId,
      set: {
        status: sql`case when ${repositoryAnalyses.status} = 'COMPLETED' then 'COMPLETED' else ${status} end`,
        lastError,
        updatedAt: now,
      },
    })
}

async function saveAnalysis(
  db: Database,
  repositoryId: string,
  provider: AIProvider,
  outcome: AnalysisOutcome,
  catalog: CatalogCategory[],
  ttlDays: number,
): Promise<void> {
  const { analysis } = outcome
  const { mapped, unmapped } = mapCategories(analysis.categories, catalog)
  const now = new Date()
  const fields = {
    status: 'COMPLETED' as const,
    summary: analysis.summary,
    purpose: analysis.purpose,
    mainUseCases: analysis.mainUseCases,
    installationSummary: analysis.installationSummary || null,
    deploymentType: analysis.deploymentType,
    frameworks: analysis.frameworks,
    maturity: analysis.maturity || null,
    advantages: analysis.advantages,
    limitations: analysis.limitations,
    targetUsers: analysis.targetUsers,
    activityAssessment: analysis.activityAssessment || null,
    abandonmentRisk: analysis.abandonmentRisk,
    aiConfidence: analysis.aiConfidence,
    provider: provider.name,
    model: provider.model,
    lastError: null,
    aiAnalyzedAt: now,
    expiresAt: analysisExpiry(now, ttlDays),
    updatedAt: now,
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(repositoryAnalyses)
      .values({ repositoryId, ...fields })
      .onConflictDoUpdate({ target: repositoryAnalyses.repositoryId, set: fields })

    // Las categorías de la IA se sustituyen; las de un ADMIN (roadmap) ganan y no se tocan.
    await tx
      .delete(repositoryCategories)
      .where(
        and(
          eq(repositoryCategories.repositoryId, repositoryId),
          eq(repositoryCategories.origin, 'AI'),
        ),
      )
    if (mapped.length) {
      await tx
        .insert(repositoryCategories)
        .values(
          mapped.map((c) => ({
            repositoryId,
            categoryId: c.id,
            origin: 'AI' as const,
            confidence: analysis.aiConfidence,
          })),
        )
        .onConflictDoNothing()
    }

    // Tags de IA: los que propone el análisis y lo que no mapeó al catálogo.
    const slugs = [
      ...new Set([...analysis.tags, ...unmapped].map((t) => normalizeTerm(t).replace(/ /g, '-'))),
    ]
      .filter((s) => s.length > 0 && s.length <= 60)
      .slice(0, 15)
    await tx
      .delete(repositoryTags)
      .where(
        and(
          eq(repositoryTags.repositoryId, repositoryId),
          inArray(
            repositoryTags.tagId,
            tx.select({ id: tags.id }).from(tags).where(eq(tags.kind, 'AI')),
          ),
        ),
      )
    if (slugs.length) {
      const rows = await tx
        .insert(tags)
        .values(slugs.map((slug) => ({ slug, kind: 'AI' as const })))
        .onConflictDoUpdate({ target: [tags.kind, tags.slug], set: { slug: sql`excluded.slug` } })
        .returning({ id: tags.id })
      await tx
        .insert(repositoryTags)
        .values(rows.map((t) => ({ repositoryId, tagId: t.id })))
        .onConflictDoNothing()
    }

    await recordUsage(tx, repositoryId, provider, outcome.calls, unmapped)

    // H5: el resumen, las categorías y los tags nuevos entran en la búsqueda
    // léxica ya, y el embedding se pide con el texto que acaba de cambiar.
    await refreshSearchVector(tx, repositoryId)
    await enqueueJob('GENERATE_EMBEDDING', repositoryId, {}, tx)
  })
}

/** Una fila por llamada; las no mapeadas van en la llamada que dio el análisis. */
async function recordUsage(
  db: Pick<Database, 'insert'>,
  repositoryId: string,
  provider: AIProvider,
  calls: AICallUsage[],
  unmapped: string[],
): Promise<void> {
  if (!calls.length) return
  await db.insert(aiUsage).values(
    calls.map((c) => ({
      repositoryId,
      provider: provider.name,
      model: provider.model,
      operation: 'ANALYSIS' as const,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      estimatedCost: c.estimatedCost,
      success: c.success,
      error: c.error,
      unmappedCategories: c.success ? unmapped : [],
    })),
  )
}
