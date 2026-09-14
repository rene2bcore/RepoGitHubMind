/**
 * Lo que RepoGitHubMind necesita saber de un repositorio público de GitHub
 * (prompt maestro §10, §13). Las fechas van separadas a propósito: «Última
 * actividad» sale de `pushedAt`, y `createdAt`, `updatedAt` y
 * `latestReleaseAt` están disponibles por separado (specs/repositories ·
 * «Última actividad»).
 */
export type GitHubRepositoryData = {
  githubRepositoryId: number
  fullName: string
  owner: string
  name: string
  url: string
  description: string | null
  homepage: string | null
  primaryLanguage: string | null
  /** Identificador SPDX (`MIT`, `Apache-2.0`) o null si GitHub no la identifica. */
  license: string | null
  topics: string[]
  /** Lenguaje -> bytes, tal como lo da GitHub. */
  languages: Record<string, number>
  stars: number
  forks: number
  openIssues: number
  archived: boolean
  fork: boolean
  defaultBranch: string | null
  /** README en Markdown crudo, o null si no hay. */
  readme: string | null
  latestRelease: string | null
  githubCreatedAt: Date | null
  githubUpdatedAt: Date | null
  githubPushedAt: Date | null
  latestReleaseAt: Date | null
}

/**
 * El único punto por el que el sistema habla con GitHub. Se llama siempre
 * con `owner/name` ya normalizado, nunca con una URL del usuario
 * (specs/repositories · «Nunca se sigue una URL del usuario»).
 *
 * Errores tipados que puede lanzar: `RepositoryNotFoundError` (404 o
 * privado) y `GitHubRateLimitError` (403/429 por límite, con la ventana
 * leída de las cabeceras).
 */
export interface GitHubProvider {
  fetchRepository(owner: string, name: string): Promise<GitHubRepositoryData>
}
