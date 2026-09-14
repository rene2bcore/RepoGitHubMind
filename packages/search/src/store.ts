import { and, eq } from 'drizzle-orm'
import type { AICallUsage } from '@rgm/ai'
import {
  aiUsage,
  categories,
  repositories,
  repositoryAnalyses,
  repositoryCategories,
  repositoryEmbeddings,
  repositoryTags,
  tags,
  type Database,
} from '@rgm/db'
import type { SemanticSource } from './semantic-text'

/**
 * Lo que entra en el texto semántico de un repositorio, leído de la base:
 * metadata, análisis, categorías del catálogo y tags de IA. `null` si el
 * repositorio no existe. Nada de `user_repositories`.
 */
export async function loadSemanticSource(
  db: Database,
  repositoryId: string,
): Promise<SemanticSource | null> {
  const [row] = await db
    .select({
      fullName: repositories.fullName,
      description: repositories.description,
      topics: repositories.topics,
      summary: repositoryAnalyses.summary,
      purpose: repositoryAnalyses.purpose,
      mainUseCases: repositoryAnalyses.mainUseCases,
    })
    .from(repositories)
    .leftJoin(repositoryAnalyses, eq(repositoryAnalyses.repositoryId, repositories.id))
    .where(eq(repositories.id, repositoryId))
    .limit(1)
  if (!row) return null
  const [categoryRows, tagRows] = await Promise.all([
    db
      .select({ name: categories.name, path: categories.path })
      .from(repositoryCategories)
      .innerJoin(categories, eq(categories.id, repositoryCategories.categoryId))
      .where(eq(repositoryCategories.repositoryId, repositoryId)),
    db
      .select({ slug: tags.slug })
      .from(repositoryTags)
      .innerJoin(tags, eq(tags.id, repositoryTags.tagId))
      .where(and(eq(repositoryTags.repositoryId, repositoryId), eq(tags.kind, 'AI'))),
  ])
  return {
    fullName: row.fullName,
    description: row.description,
    summary: row.summary,
    purpose: row.purpose,
    mainUseCases: row.mainUseCases ?? [],
    categories: categoryRows.map((c) => `${c.name} (${c.path})`),
    tags: tagRows.map((t) => t.slug),
    topics: row.topics,
  }
}

export async function storedEmbedding(
  db: Database,
  repositoryId: string,
): Promise<{ sourceHash: string; model: string } | null> {
  const [row] = await db
    .select({ sourceHash: repositoryEmbeddings.sourceHash, model: repositoryEmbeddings.model })
    .from(repositoryEmbeddings)
    .where(eq(repositoryEmbeddings.repositoryId, repositoryId))
    .limit(1)
  return row ?? null
}

/** Sustituye el embedding de un repositorio: uno por repositorio, el del texto vigente. */
export async function saveEmbedding(
  db: Pick<Database, 'insert'>,
  repositoryId: string,
  value: { embedding: number[]; model: string; sourceHash: string },
): Promise<void> {
  const now = new Date()
  await db
    .insert(repositoryEmbeddings)
    .values({ repositoryId, ...value, createdAt: now })
    .onConflictDoUpdate({
      target: repositoryEmbeddings.repositoryId,
      set: { ...value, createdAt: now },
    })
}

/**
 * Una fila de `ai_usage` por llamada de embeddings, también las que fallan
 * (specs/ai · «Todo uso se registra»). `repositoryId` es null para el
 * embedding de una consulta de búsqueda: no es de ningún repositorio, y no se
 * guarda ni la consulta ni quién la hizo.
 */
export async function recordEmbeddingUsage(
  db: Pick<Database, 'insert'>,
  repositoryId: string | null,
  provider: { name: string; model: string },
  calls: AICallUsage[],
): Promise<void> {
  if (!calls.length) return
  await db.insert(aiUsage).values(
    calls.map((c) => ({
      repositoryId,
      provider: provider.name,
      model: provider.model,
      operation: 'EMBEDDING' as const,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      estimatedCost: c.estimatedCost,
      success: c.success,
      error: c.error,
    })),
  )
}
