import { describe, expect, it } from 'vitest'
import { flattenTaxonomy } from '@rgm/db'
import { mapCategories } from '../src/taxonomy-mapper'

/**
 * specs/ai · «Categorías del catálogo» («Sugerencia mapeable», «Sugerencia
 * que no existe») contra el catálogo real del seed, con sus sinónimos.
 */
const catalog = flattenTaxonomy().map((c) => ({ ...c, id: c.path }))
const paths = (suggestions: string[]) => {
  const { mapped, unmapped } = mapCategories(suggestions, catalog)
  return { mapped: mapped.map((c) => c.path), unmapped }
}

describe('mapeador de taxonomía', () => {
  it('«vector similarity search» queda en data/databases/vector; «quantum finance» no crea nada', () => {
    expect(paths(['vector similarity search', 'quantum finance'])).toEqual({
      mapped: ['data/databases/vector'],
      unmapped: ['quantum finance'],
    })
  })

  it('casa por ruta, slug, nombre o sinónimo, sin mayúsculas ni separadores, y sin duplicar', () => {
    expect(
      paths([
        'data/databases/vector',
        'Data > Databases > Vector',
        'LLM',
        'Retrieval Augmented Generation (RAG)',
        'CI/CD',
        'Docker',
        'Machine Learning',
        'agent-memory',
      ]).mapped,
    ).toEqual([
      'data/databases/vector',
      'artificial-intelligence/llm',
      'artificial-intelligence/llm/rag',
      'developer-tools/devops/ci-cd',
      'developer-tools/devops/containers',
      'artificial-intelligence/ml',
      'artificial-intelligence/agents/agent-memory',
    ])
  })

  it('un término de una palabra no casa por contención, y a igualdad gana el slug sobre el nombre', () => {
    expect(paths(['memory safety', 'postgres extension'])).toEqual({
      mapped: [],
      unmapped: ['memory safety', 'postgres extension'],
    })
    // «Generation» es el nombre de dos hojas; el slug `generation` es la de imagen.
    expect(paths(['Generation', 'video generation']).mapped).toEqual([
      'media/image/generation',
      'media/video/video-generation',
    ])
  })
})
