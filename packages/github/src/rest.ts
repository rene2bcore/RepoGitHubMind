import { GitHubRateLimitError, RepositoryNotFoundError } from '@rgm/shared'
import type { GitHubProvider, GitHubRepositoryData } from './provider'

const API = 'https://api.github.com'
const USER_AGENT = 'RepoGitHubMind (+https://github.com/rene2bcore/RepoGitHubMind)'

type FetchLike = typeof fetch

type RepoJson = {
  id: number
  full_name: string
  owner: { login: string }
  name: string
  html_url: string
  description: string | null
  homepage: string | null
  language: string | null
  license: { spdx_id: string | null } | null
  topics?: string[]
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  archived: boolean
  fork: boolean
  default_branch: string | null
  created_at: string | null
  updated_at: string | null
  pushed_at: string | null
}

type ReleaseJson = { tag_name: string | null; name: string | null; published_at: string | null }

/**
 * `GitHubProvider` sobre la REST API, con requests autenticadas desde el
 * servidor cuando hay `GITHUB_TOKEN`, y las cabeceras de versión que GitHub
 * recomienda. El token nunca sale de aquí (specs/repositories · «El token
 * nunca sale»).
 *
 * Cuando GitHub limita (403 o 429 con `x-ratelimit-remaining: 0`, o
 * `retry-after`), se recuerda hasta cuándo y **no se vuelve a llamar** hasta
 * que pase la ventana: cada llamada en ese intervalo lanza
 * `GitHubRateLimitError` sin tocar la red.
 */
export class RestGitHubProvider implements GitHubProvider {
  private blockedUntil = 0

  constructor(
    private readonly options: { token?: string; fetchImpl?: FetchLike; now?: () => number } = {},
  ) {}

  /** Hasta cuándo no se llama a GitHub, o null si no hay bloqueo vigente. */
  rateLimitedUntil(): Date | null {
    return this.blockedUntil > this.now() ? new Date(this.blockedUntil) : null
  }

  async fetchRepository(owner: string, name: string): Promise<GitHubRepositoryData> {
    const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
    const repo = (await this.get(base)) as RepoJson

    const [languages, readme, release] = await Promise.all([
      this.get(`${base}/languages`).catch(() => ({})) as Promise<Record<string, number>>,
      this.getText(`${base}/readme`, 'application/vnd.github.raw+json').catch(() => null),
      this.get(`${base}/releases/latest`).catch(() => null) as Promise<ReleaseJson | null>,
    ])

    return {
      githubRepositoryId: repo.id,
      fullName: repo.full_name.toLowerCase(),
      owner: repo.owner.login.toLowerCase(),
      name: repo.name.toLowerCase(),
      url: repo.html_url,
      description: repo.description,
      homepage: repo.homepage || null,
      primaryLanguage: repo.language,
      license: normalizeLicense(repo.license?.spdx_id),
      topics: repo.topics ?? [],
      languages: languages ?? {},
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      archived: repo.archived,
      fork: repo.fork,
      defaultBranch: repo.default_branch,
      readme,
      latestRelease: release?.tag_name ?? release?.name ?? null,
      githubCreatedAt: toDate(repo.created_at),
      githubUpdatedAt: toDate(repo.updated_at),
      githubPushedAt: toDate(repo.pushed_at),
      latestReleaseAt: toDate(release?.published_at ?? null),
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)()
  }

  private async get(url: string): Promise<unknown> {
    const res = await this.request(url, 'application/vnd.github+json')
    return res.json()
  }

  private async getText(url: string, accept: string): Promise<string> {
    const res = await this.request(url, accept)
    return res.text()
  }

  private async request(url: string, accept: string): Promise<Response> {
    if (this.blockedUntil > this.now()) throw new GitHubRateLimitError()
    const headers: Record<string, string> = {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
    }
    if (this.options.token) headers.Authorization = `Bearer ${this.options.token}`
    const res = await (this.options.fetchImpl ?? fetch)(url, { headers })
    if (res.ok) return res
    if (isRateLimited(res)) {
      this.blockedUntil = resetFrom(res, this.now())
      throw new GitHubRateLimitError()
    }
    if (res.status === 404) throw new RepositoryNotFoundError()
    throw new Error(`GitHub respondió ${res.status} a ${new URL(url).pathname}`)
  }
}

function isRateLimited(res: Response): boolean {
  if (res.status === 429) return true
  return res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0'
}

/** La ventana que GitHub declara, con un minuto de cortesía si no dice nada. */
function resetFrom(res: Response, now: number): number {
  const retryAfter = Number(res.headers.get('retry-after'))
  if (retryAfter > 0) return now + retryAfter * 1000
  const reset = Number(res.headers.get('x-ratelimit-reset'))
  if (reset > 0) return Math.max(now + 1000, reset * 1000)
  return now + 60_000
}

function normalizeLicense(spdx: string | null | undefined): string | null {
  if (!spdx || spdx === 'NOASSERTION') return null
  return spdx
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
