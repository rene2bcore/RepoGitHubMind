import type { AnalysisRequest, CatalogCategory } from '../../src/provider'
import type { RepositoryAnalysis } from '../../src/schema'

/**
 * Grabaciones para las pruebas del proveedor: un repositorio con su catálogo
 * y la forma de respuesta de `POST /api/v1/chat/completions` de OpenRouter.
 * No son pruebas (R-08): son los datos que las pruebas usan.
 */
export const CATALOG: CatalogCategory[] = [
  { id: 'c1', slug: 'data', name: 'Data', path: 'data', synonyms: [] },
  { id: 'c2', slug: 'databases', name: 'Databases', path: 'data/databases', synonyms: [] },
  {
    id: 'c3',
    slug: 'vector',
    name: 'Vector',
    path: 'data/databases/vector',
    synonyms: ['vector search', 'vector database', 'similarity search'],
  },
]

export function request(overrides: Partial<AnalysisRequest['repository']> = {}): AnalysisRequest {
  return {
    repository: {
      fullName: 'pgvector/pgvector',
      description: 'Open-source vector similarity search for Postgres',
      homepage: null,
      primaryLanguage: 'C',
      license: 'PostgreSQL',
      topics: ['postgres', 'vector', 'similarity-search'],
      languages: { C: 412000, PLpgSQL: 21000 },
      stars: 19400,
      forks: 980,
      openIssues: 45,
      archived: false,
      fork: false,
      latestRelease: 'v0.8.0',
      latestReleaseAt: new Date('2024-10-30T00:00:00Z'),
      githubCreatedAt: new Date('2021-04-20T13:03:00Z'),
      githubPushedAt: new Date('2026-09-12T10:04:00Z'),
      readme: '# pgvector\n\nOpen-source vector similarity search for Postgres.\n',
      ...overrides,
    },
    catalog: CATALOG,
    maxReadmeChars: 12000,
    now: new Date('2026-09-14T12:00:00Z'),
  }
}

export const VALID: RepositoryAnalysis = {
  summary: 'Extensión de PostgreSQL para guardar vectores y buscar por similitud.',
  purpose: 'Añade a PostgreSQL un tipo vector e índices para búsqueda de vecinos más cercanos.',
  mainUseCases: ['Búsqueda semántica', 'RAG sobre PostgreSQL'],
  categories: ['data/databases/vector'],
  tags: ['postgres', 'embeddings'],
  installationSummary:
    'Compilar con make e instalar con make install; después CREATE EXTENSION vector.',
  deploymentType: ['extensión de PostgreSQL'],
  frameworks: [],
  maturity: 'estable',
  advantages: ['Sin infraestructura aparte'],
  limitations: ['Requiere compilar la extensión'],
  targetUsers: ['equipos de backend'],
  activityAssessment: 'Push reciente y releases periódicas.',
  abandonmentRisk: 'LOW',
  aiConfidence: 0.8,
}

export function completion(
  content: string,
  usage = { prompt: 1200, completion: 300, cost: 0.00024 },
) {
  return {
    id: 'gen-grabada',
    model: 'modelo/de-prueba',
    object: 'chat.completion',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage: {
      prompt_tokens: usage.prompt,
      completion_tokens: usage.completion,
      total_tokens: usage.prompt + usage.completion,
      cost: usage.cost,
    },
  }
}
