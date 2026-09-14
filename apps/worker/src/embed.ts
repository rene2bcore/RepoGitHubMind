import { AIProviderCallError, getEmbeddingProvider } from '@rgm/ai'
import { getDb, type Database, type Job } from '@rgm/db'
import {
  buildSemanticText,
  embeddingIsCurrent,
  loadSemanticSource,
  recordEmbeddingUsage,
  saveEmbedding,
  semanticTextHash,
  storedEmbedding,
} from '@rgm/search'
import { readEnv } from '@rgm/shared'

export type EmbeddingJobResult = 'disabled' | 'missing' | 'cached' | 'embedded'

/** Tope de vectorizaciones si el texto sigue cambiando mientras se vectoriza. */
const MAX_PASSES = 3

/**
 * `GENERATE_EMBEDDING` (specs/search · «Qué se vectoriza»). Se encola al
 * completar un análisis. Idempotente: si el texto semántico y el modelo son
 * los del embedding guardado, no llama al proveedor ni registra coste
 * («Texto sin cambios», CA-9).
 *
 * - Con `AI_ANALYSIS_ENABLED=false`, no hace nada: la búsqueda sigue en modo
 *   léxico.
 * - Si el proveedor responde, guarda el vector y su fila de `ai_usage` en una
 *   transacción.
 * - Si falla, registra la llamada y relanza para que la cola decida: backoff
 *   si es reintentable, `FAILED` si no (una dimensión que no es la del
 *   esquema). El repositorio sigue apareciendo por coincidencia léxica.
 *
 * Tras guardar vuelve a leer el texto: si otro worker completó un reanálisis
 * mientras tanto, su `GENERATE_EMBEDDING` no se encoló porque este estaba en
 * curso, y el vector guardado sería del texto anterior. Se repite hasta que
 * lo guardado corresponde con lo vigente; si tras `MAX_PASSES` vectorizaciones
 * el texto sigue cambiando, falla con un error reintentable y la cola lo
 * vuelve a intentar con backoff, en vez de terminar con un vector viejo.
 */
export async function generateEmbeddingJob(
  job: Job,
  db: Database = getDb(),
): Promise<EmbeddingJobResult> {
  const repositoryId = job.repositoryId
  if (!repositoryId) return 'missing'
  if (!readEnv().AI_ANALYSIS_ENABLED) return 'disabled'
  const provider = getEmbeddingProvider()

  let result: EmbeddingJobResult = 'cached'
  for (let pass = 0; ; pass++) {
    const source = await loadSemanticSource(db, repositoryId)
    if (!source) return 'missing'
    const text = buildSemanticText(source)
    const next = { sourceHash: semanticTextHash(text), model: provider.model }
    if (embeddingIsCurrent(await storedEmbedding(db, repositoryId), next)) return result
    if (pass >= MAX_PASSES) {
      throw new Error(`el texto semántico siguió cambiando tras ${MAX_PASSES} vectorizaciones`)
    }

    let outcome
    try {
      outcome = await provider.embed([text])
    } catch (error) {
      if (error instanceof AIProviderCallError) {
        await recordEmbeddingUsage(db, repositoryId, provider, error.calls)
      }
      throw error
    }
    await db.transaction(async (tx) => {
      await saveEmbedding(tx, repositoryId, { embedding: outcome.vectors[0]!, ...next })
      await recordEmbeddingUsage(tx, repositoryId, provider, [outcome.call])
    })
    result = 'embedded'
  }
}
