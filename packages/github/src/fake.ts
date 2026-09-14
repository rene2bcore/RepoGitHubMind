import { GitHubRateLimitError, RepositoryNotFoundError } from '@rgm/shared'
import type { GitHubProvider, GitHubRepositoryData } from './provider'

/**
 * `GitHubProvider` sin red, para pruebas y para desarrollar sin token
 * (`GITHUB_FAKE=1`). Respuestas grabadas de repositorios reales, un 404 y un
 * 429: lo que la spec necesita para cada escenario. Cuenta las llamadas para
 * que una prueba pueda afirmar que un repositorio guardado por dos cuentas
 * se pidió a GitHub **una** vez (specs/repositories · «Segunda cuenta»).
 */
export class FakeGitHubProvider implements GitHubProvider {
  calls: string[] = []

  async fetchRepository(owner: string, name: string): Promise<GitHubRepositoryData> {
    const fullName = `${owner}/${name}`.toLowerCase()
    this.calls.push(fullName)
    if (fullName === 'limite/limite') throw new GitHubRateLimitError()
    const data = FIXTURES[fullName]
    if (!data) throw new RepositoryNotFoundError()
    return structuredClone(data)
  }
}

const day = (iso: string) => new Date(iso)

export const FIXTURES: Record<string, GitHubRepositoryData> = {
  'pgvector/pgvector': {
    githubRepositoryId: 359005955,
    fullName: 'pgvector/pgvector',
    owner: 'pgvector',
    name: 'pgvector',
    url: 'https://github.com/pgvector/pgvector',
    description: 'Open-source vector similarity search for Postgres',
    homepage: null,
    primaryLanguage: 'C',
    license: 'PostgreSQL',
    topics: ['postgres', 'vector', 'similarity-search', 'nearest-neighbor-search'],
    languages: { C: 412000, PLpgSQL: 21000, Makefile: 3000 },
    stars: 19400,
    forks: 980,
    openIssues: 45,
    archived: false,
    fork: false,
    defaultBranch: 'master',
    readme:
      '# pgvector\n\nOpen-source vector similarity search for Postgres.\n\n## Installation\n\n```sh\ncd /tmp\ngit clone --branch v0.8.0 https://github.com/pgvector/pgvector.git\ncd pgvector\nmake\nmake install\n```\n\n## Getting Started\n\nEnable the extension:\n\n```sql\nCREATE EXTENSION vector;\n```\n',
    latestRelease: 'v0.8.0',
    githubCreatedAt: day('2021-04-20T13:03:00Z'),
    githubUpdatedAt: day('2026-09-12T10:04:00Z'),
    githubPushedAt: day('2026-09-12T10:04:00Z'),
    latestReleaseAt: day('2024-10-30T00:00:00Z'),
  },
  'langchain-ai/langgraph': {
    githubRepositoryId: 683862443,
    fullName: 'langchain-ai/langgraph',
    owner: 'langchain-ai',
    name: 'langgraph',
    url: 'https://github.com/langchain-ai/langgraph',
    description: 'Build resilient language agents as graphs.',
    homepage: 'https://langchain-ai.github.io/langgraph/',
    primaryLanguage: 'Python',
    license: 'MIT',
    topics: ['agents', 'llm', 'orchestration'],
    languages: { Python: 2100000, TypeScript: 8000 },
    stars: 15800,
    forks: 2700,
    openIssues: 120,
    archived: false,
    fork: false,
    defaultBranch: 'main',
    readme:
      '# LangGraph\n\nBuild resilient language agents as graphs.\n\n## Installation\n\n```bash\npip install -U langgraph\n```\n',
    latestRelease: '0.6.0',
    githubCreatedAt: day('2023-08-09T00:00:00Z'),
    githubUpdatedAt: day('2026-09-10T18:00:00Z'),
    githubPushedAt: day('2026-09-10T18:00:00Z'),
    latestReleaseAt: day('2026-08-20T00:00:00Z'),
  },
  'antirez/kilo': {
    githubRepositoryId: 60421103,
    fullName: 'antirez/kilo',
    owner: 'antirez',
    name: 'kilo',
    url: 'https://github.com/antirez/kilo',
    description: 'A text editor in less than 1000 LOC with syntax highlight and search.',
    homepage: null,
    primaryLanguage: 'C',
    license: 'BSD-2-Clause',
    topics: [],
    languages: { C: 38000 },
    stars: 7800,
    forks: 900,
    openIssues: 30,
    archived: false,
    fork: false,
    defaultBranch: 'master',
    readme:
      '# Kilo\n\nKilo is a small text editor in less than 1K lines of code.\n\n<script>window.hostil = true</script>\n\n<iframe src="https://example.com"></iframe>\n\n## Usage\n\n```sh\n./kilo file.c\n```\n',
    latestRelease: null,
    githubCreatedAt: day('2016-06-04T00:00:00Z'),
    githubUpdatedAt: day('2024-01-15T00:00:00Z'),
    githubPushedAt: day('2020-03-01T00:00:00Z'),
    latestReleaseAt: null,
  },
}
