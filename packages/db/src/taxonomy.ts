import { sql } from 'drizzle-orm'
import type { Database } from './client'
import { categories } from './schema'

/**
 * El catálogo inicial de `docs/taxonomy.md`, con sus sinónimos. Es el seed de
 * `categories` en todos los entornos. `packages/db/tests/taxonomia.test.ts`
 * lo contrasta con el árbol y la tabla de sinónimos del documento: cambiar
 * uno sin el otro pone la suite en rojo.
 */
type Node = { slug: string; name: string; synonyms?: string[]; children?: Node[] }

const leaf = (slug: string, name: string, synonyms?: string[]): Node => ({ slug, name, synonyms })

export const TAXONOMY: Node[] = [
  {
    slug: 'artificial-intelligence',
    name: 'Artificial Intelligence',
    children: [
      {
        slug: 'agents',
        name: 'Agents',
        children: [
          leaf('agent-frameworks', 'Agent Frameworks', ['agentic', 'autonomous agents']),
          leaf('multi-agent', 'Multi-Agent'),
          leaf('agent-orchestration', 'Agent Orchestration'),
          leaf('agent-memory', 'Agent Memory', ['memory', 'long-term memory']),
          leaf('agent-tools', 'Agent Tools'),
        ],
      },
      {
        slug: 'llm',
        name: 'LLM',
        children: [
          leaf('inference', 'Inference'),
          leaf('rag', 'RAG', ['retrieval', 'retrieval augmented generation']),
          leaf('embeddings', 'Embeddings'),
          leaf('fine-tuning', 'Fine-tuning'),
          leaf('evaluation', 'Evaluation'),
        ],
      },
      {
        slug: 'ml',
        name: 'Machine Learning',
        children: [leaf('training', 'Training'), leaf('datasets', 'Datasets')],
      },
      {
        slug: 'ai-applications',
        name: 'AI Applications',
        children: [
          leaf('chat', 'Chat'),
          leaf('coding-assistants', 'Coding Assistants'),
          leaf('automation', 'Automation'),
        ],
      },
    ],
  },
  {
    slug: 'media',
    name: 'Media',
    children: [
      {
        slug: 'image',
        name: 'Image',
        children: [
          leaf('generation', 'Generation'),
          leaf('editing', 'Editing'),
          leaf('computer-vision', 'Computer Vision'),
        ],
      },
      {
        slug: 'audio',
        name: 'Audio',
        children: [
          leaf('voice', 'Voice'),
          leaf('speech-to-text', 'Speech-to-Text', ['stt', 'asr', 'transcription']),
          leaf('text-to-speech', 'Text-to-Speech', ['tts']),
          leaf('audio-editing', 'Audio Editing'),
        ],
      },
      {
        slug: 'video',
        name: 'Video',
        children: [leaf('video-generation', 'Generation'), leaf('video-editing', 'Editing')],
      },
    ],
  },
  {
    slug: 'developer-tools',
    name: 'Developer Tools',
    children: [
      leaf('ide', 'IDE'),
      leaf('cli', 'CLI'),
      leaf('testing', 'Testing'),
      leaf('documentation', 'Documentation'),
      leaf('code-analysis', 'Code Analysis'),
      leaf('build', 'Build'),
      {
        slug: 'devops',
        name: 'DevOps',
        children: [
          leaf('ci-cd', 'CI/CD', ['ci', 'github actions', 'pipelines']),
          leaf('containers', 'Containers', ['docker', 'kubernetes']),
          leaf('infrastructure-as-code', 'Infrastructure as Code'),
        ],
      },
    ],
  },
  {
    slug: 'data',
    name: 'Data',
    children: [
      {
        slug: 'databases',
        name: 'Databases',
        children: [
          leaf('relational', 'Relational'),
          leaf('vector', 'Vector', ['vector search', 'vector database', 'similarity search']),
          leaf('key-value', 'Key-Value'),
          leaf('graph', 'Graph'),
        ],
      },
      leaf('search', 'Search'),
      leaf('data-pipelines', 'Data Pipelines'),
      leaf('analytics', 'Analytics'),
    ],
  },
  {
    slug: 'web',
    name: 'Web',
    children: [
      leaf('frontend-frameworks', 'Frontend Frameworks'),
      leaf('backend-frameworks', 'Backend Frameworks'),
      leaf('ui-components', 'UI Components'),
      leaf('cms', 'CMS'),
      leaf('auth', 'Auth'),
    ],
  },
  {
    slug: 'self-hosted',
    name: 'Self-hosted',
    synonyms: ['homelab'],
    children: [
      leaf('productivity', 'Productivity'),
      leaf('communication', 'Communication'),
      leaf('home', 'Home'),
      leaf('monitoring', 'Monitoring'),
    ],
  },
  {
    slug: 'security',
    name: 'Security',
    children: [
      leaf('scanning', 'Scanning'),
      leaf('secrets', 'Secrets'),
      leaf('identity', 'Identity'),
    ],
  },
  {
    slug: 'mobile',
    name: 'Mobile',
    children: [
      leaf('cross-platform', 'Cross-platform'),
      leaf('ios', 'iOS'),
      leaf('android', 'Android'),
    ],
  },
  { slug: 'utilities', name: 'Utilities', children: [leaf('other', 'Other')] },
]

export type TaxonomyEntry = {
  slug: string
  name: string
  path: string
  depth: number
  parentSlug: string | null
  synonyms: string[]
}

/** El árbol en orden de recorrido: cada padre antes que sus hijos. */
export function flattenTaxonomy(nodes: Node[] = TAXONOMY): TaxonomyEntry[] {
  const out: TaxonomyEntry[] = []
  const walk = (list: Node[], parent: TaxonomyEntry | null) => {
    for (const node of list) {
      const entry: TaxonomyEntry = {
        slug: node.slug,
        name: node.name,
        path: parent ? `${parent.path}/${node.slug}` : node.slug,
        depth: parent ? parent.depth + 1 : 0,
        parentSlug: parent?.slug ?? null,
        synonyms: node.synonyms ?? [],
      }
      out.push(entry)
      walk(node.children ?? [], entry)
    }
  }
  walk(nodes, null)
  return out
}

/**
 * Siembra el catálogo. Idempotente: por `slug`, actualiza nombre, ruta,
 * profundidad, padre y sinónimos. No borra categorías que salgan del
 * catálogo, porque pueden tener repositorios asociados. Una sentencia por
 * nivel del árbol: cada nivel necesita los ids del anterior.
 */
export async function seedTaxonomy(db: Database): Promise<number> {
  const entries = flattenTaxonomy()
  const ids = new Map<string, string>()
  const depths = Math.max(...entries.map((e) => e.depth))
  for (let depth = 0; depth <= depths; depth++) {
    const values = entries
      .filter((e) => e.depth === depth)
      .map((e) => ({
        slug: e.slug,
        name: e.name,
        path: e.path,
        depth: e.depth,
        parentId: e.parentSlug ? (ids.get(e.parentSlug) ?? null) : null,
        synonyms: e.synonyms,
      }))
    const rows = await db
      .insert(categories)
      .values(values)
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: sql`excluded.name`,
          path: sql`excluded.path`,
          depth: sql`excluded.depth`,
          parentId: sql`excluded.parent_id`,
          synonyms: sql`excluded.synonyms`,
        },
      })
      .returning({ id: categories.id, slug: categories.slug })
    for (const row of rows) ids.set(row.slug, row.id)
  }
  if (ids.size !== entries.length) throw new Error('el catálogo no se sembró entero')
  return ids.size
}
