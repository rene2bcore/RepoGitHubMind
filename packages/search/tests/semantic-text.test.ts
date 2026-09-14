import { describe, expect, it } from 'vitest'
import {
  MAX_SEMANTIC_TEXT_CHARS,
  buildSemanticText,
  embeddingIsCurrent,
  semanticTextHash,
  type SemanticSource,
} from '../src/semantic-text'

/**
 * specs/search · «Qué se vectoriza» y «Texto sin cambios» (CA-9): una sola
 * representación por repositorio con los ocho campos de la spec, y un hash
 * que solo cambia cuando cambia lo que se vectoriza.
 */
const pgvector: SemanticSource = {
  fullName: 'pgvector/pgvector',
  description: 'Open-source vector similarity search for Postgres',
  summary: 'Extensión de PostgreSQL para guardar vectores y buscar por similitud.',
  purpose: 'Añade a PostgreSQL un tipo vector e índices de vecinos más cercanos.',
  mainUseCases: ['Búsqueda semántica', 'RAG sobre PostgreSQL'],
  categories: ['Vector (data/databases/vector)'],
  tags: ['postgres', 'embeddings'],
  topics: ['postgres', 'vector', 'similarity-search'],
}

describe('texto semántico', () => {
  it('lleva nombre, descripción, resumen, propósito, casos de uso, categorías, tags y topics, en líneas etiquetadas y en ese orden', () => {
    expect(buildSemanticText(pgvector)).toBe(
      [
        'Repositorio: pgvector/pgvector',
        'Descripción: Open-source vector similarity search for Postgres',
        'Resumen: Extensión de PostgreSQL para guardar vectores y buscar por similitud.',
        'Propósito: Añade a PostgreSQL un tipo vector e índices de vecinos más cercanos.',
        'Casos de uso: Búsqueda semántica; RAG sobre PostgreSQL',
        'Categorías: Vector (data/databases/vector)',
        'Tags: embeddings; postgres',
        'Topics: postgres; similarity-search; vector',
      ].join('\n'),
    )
    // Sin análisis todavía: solo lo que hay, sin líneas vacías.
    expect(
      buildSemanticText({
        ...pgvector,
        summary: null,
        purpose: '  ',
        mainUseCases: [],
        categories: [],
        tags: [],
      }),
    ).toBe(
      'Repositorio: pgvector/pgvector\nDescripción: Open-source vector similarity search for Postgres\nTopics: postgres; similarity-search; vector',
    )
    expect(
      buildSemanticText({ ...pgvector, description: 'x'.repeat(20_000) }).length,
    ).toBeLessThanOrEqual(MAX_SEMANTIC_TEXT_CHARS)
  })

  it('el hash no cambia si solo cambian el orden de topics, tags o categorías o los espacios, y cambia si cambia el contenido', () => {
    const base = semanticTextHash(buildSemanticText(pgvector))
    expect(base).toMatch(/^[0-9a-f]{64}$/)
    const reordenado = {
      ...pgvector,
      topics: ['similarity-search', 'vector', 'postgres', 'vector'],
      tags: ['embeddings', 'postgres'],
      description: '  Open-source   vector similarity search for Postgres ',
    }
    expect(semanticTextHash(buildSemanticText(reordenado))).toBe(base)
    expect(
      semanticTextHash(buildSemanticText({ ...pgvector, summary: 'Otro resumen del análisis.' })),
    ).not.toBe(base)
    // Los casos de uso conservan el orden de la IA: reordenarlos sí es otro texto.
    expect(
      semanticTextHash(
        buildSemanticText({
          ...pgvector,
          mainUseCases: ['RAG sobre PostgreSQL', 'Búsqueda semántica'],
        }),
      ),
    ).not.toBe(base)
  })

  it('un embedding sirve con el mismo hash y el mismo modelo; otro modelo o ninguno obligan a pedirlo', () => {
    const next = { sourceHash: 'abc', model: 'openai/text-embedding-3-small' }
    expect(embeddingIsCurrent({ ...next }, next)).toBe(true)
    expect(embeddingIsCurrent({ ...next, sourceHash: 'otro' }, next)).toBe(false)
    expect(embeddingIsCurrent({ ...next, model: 'fake-embedding' }, next)).toBe(false)
    expect(embeddingIsCurrent(null, next)).toBe(false)
  })
})
