import { describe, expect, it } from 'vitest'
import { explainMatch } from '../src/explain'
import { lexicalTerms, prefixTsQuery } from '../src/query'

/**
 * specs/search · «Resultado legible» (el «Por qué» en una línea) y la
 * consulta léxica de «Búsqueda híbrida».
 */
describe('consulta léxica', () => {
  it('parte como el analizador simple, quita palabras vacías en castellano e inglés, conserva acentos y no repite', () => {
    expect(lexicalTerms('Vectores en Postgres')).toEqual(['vectores', 'postgres'])
    expect(lexicalTerms('herramienta para la memoria de los agentes')).toEqual([
      'herramienta',
      'memoria',
      'agentes',
    ])
    expect(lexicalTerms('the similarity-search for AI, ai y búsqueda')).toEqual([
      'similarity',
      'search',
      'ai',
      'búsqueda',
    ])
    expect(lexicalTerms('de la y en')).toEqual([])
    expect(prefixTsQuery(['vectores', 'postgres'])).toBe('vectores:* | postgres:*')
    expect(prefixTsQuery([])).toBeNull()
  })
})

describe('por qué aparece un resultado', () => {
  it('coincidencia léxica: qué palabras y en qué campos, con la categoría por su nombre', () => {
    expect(
      explainMatch({
        terms: ['postgres'],
        fields: ['description', 'topics'],
        semantic: false,
        categories: ['Vector'],
        about: 'no se usa',
      }),
    ).toBe('Coincide «postgres» en la descripción y los topics')
    expect(
      explainMatch({
        terms: ['vector', 'postgres'],
        fields: ['name', 'categories', 'tags'],
        semantic: true,
        categories: ['Vector'],
        about: null,
      }),
    ).toBe(
      'Coincide «vector» y «postgres» en el nombre, la categoría Vector y los tags, y se parece por significado a lo que buscas',
    )
    expect(
      explainMatch({
        terms: ['agents'],
        fields: ['categories'],
        semantic: false,
        categories: ['Agents', 'LLM'],
        about: null,
      }),
    ).toBe('Coincide «agents» en las categorías Agents y LLM')
  })

  it('solo por significado: lo dice y cuenta de qué va el repositorio, recortado a una línea', () => {
    expect(
      explainMatch({
        terms: [],
        fields: [],
        semantic: true,
        categories: [],
        about: 'Extensión de PostgreSQL para guardar vectores y buscar por similitud.',
      }),
    ).toBe(
      'Se parece por significado a lo que buscas: Extensión de PostgreSQL para guardar vectores y buscar por similitud.',
    )
    const largo = explainMatch({
      terms: [],
      fields: [],
      semantic: true,
      categories: [],
      about: 'palabra '.repeat(40),
    })
    expect(largo.endsWith('…')).toBe(true)
    expect(largo.length).toBeLessThanOrEqual(
      'Se parece por significado a lo que buscas: '.length + 110,
    )
    expect(
      explainMatch({ terms: [], fields: [], semantic: true, categories: [], about: null }),
    ).toBe('Se parece por significado a lo que buscas')
  })
})
