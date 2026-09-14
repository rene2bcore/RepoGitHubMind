import { describe, expect, it } from 'vitest'
import { extractGitHubRefs, parseGitHubUrl } from '../src/github-url'
import { InvalidGitHubUrlError } from '../src/errors'

/**
 * specs/repositories · «Una URL en cualquier variante» y «Nunca se sigue una
 * URL del usuario». Es la regla de dominio del prompt maestro §30: todas las
 * variantes terminan en la misma Repository.
 */
describe('parseGitHubUrl', () => {
  it.each([
    'https://github.com/pgvector/pgvector',
    'http://github.com/pgvector/pgvector/',
    'github.com/pgvector/pgvector',
    'www.github.com/pgvector/pgvector.git',
    'https://github.com/PGvector/PGVector.git?x=1#readme',
    'https://github.com/pgvector/pgvector/tree/main/src',
  ])('normaliza %s a pgvector/pgvector', (input) => {
    expect(parseGitHubUrl(input)).toEqual({
      owner: 'pgvector',
      name: 'pgvector',
      fullName: 'pgvector/pgvector',
    })
  })

  it.each([
    '',
    'https://gitlab.com/owner/repo',
    'https://github.com/solo-owner',
    'https://github.com/',
    'https://evil.com/github.com/owner/repo',
    'https://github.com.evil.com/owner/repo',
    'no es una url',
    'https://github.com/-bad/repo',
  ])('rechaza %s con InvalidGitHubUrlError', (input) => {
    expect(() => parseGitHubUrl(input)).toThrow(InvalidGitHubUrlError)
  })

  it('el error de URL sale como 422 sobre el campo url', () => {
    try {
      parseGitHubUrl('https://gitlab.com/a/b')
    } catch (error) {
      const e = error as InvalidGitHubUrlError
      expect(e.status).toBe(422)
      expect(e.items[0]?.field).toBe('url')
    }
  })
})

describe('extractGitHubRefs', () => {
  it('extrae, deduplica y cuenta las inválidas de un texto pegado', () => {
    const texto = `
      Mira https://github.com/pgvector/pgvector y también github.com/PGVECTOR/pgvector/
      Este no: https://github.com/solo-owner
      Otro: https://github.com/langchain-ai/langgraph.git
    `
    const { refs, invalid } = extractGitHubRefs(texto)
    expect(refs.map((r) => r.fullName)).toEqual(['pgvector/pgvector', 'langchain-ai/langgraph'])
    expect(invalid).toBe(1)
  })
})
