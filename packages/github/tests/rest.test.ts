import { describe, expect, it } from 'vitest'
import { GitHubRateLimitError, RepositoryNotFoundError } from '@rgm/shared'
import { RestGitHubProvider } from '../src/rest'

/**
 * specs/repositories · «Metadata de GitHub al guardar»: «Metadata visible»,
 * «Última actividad», «Repositorio privado o inexistente», «Rate limit de
 * GitHub», «El token nunca sale». Sin red: un `fetch` grabado que apunta qué
 * se pidió y con qué cabeceras.
 */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} })
    const path = new URL(url).pathname
    const route = Object.entries(routes).find(([k]) => path === k)
    return route ? route[1]() : new Response('not found', { status: 404 })
  }) as typeof fetch
  return { fetchImpl, calls }
}

const REPO = {
  id: 359005955,
  full_name: 'PGvector/pgvector',
  owner: { login: 'PGvector' },
  name: 'pgvector',
  html_url: 'https://github.com/pgvector/pgvector',
  description: 'Open-source vector similarity search for Postgres',
  homepage: '',
  language: 'C',
  license: { spdx_id: 'PostgreSQL' },
  topics: ['postgres', 'vector'],
  stargazers_count: 19400,
  forks_count: 980,
  open_issues_count: 45,
  archived: false,
  fork: false,
  default_branch: 'master',
  created_at: '2021-04-20T13:03:00Z',
  updated_at: '2026-09-12T10:04:00Z',
  pushed_at: '2026-09-11T08:00:00Z',
}

describe('RestGitHubProvider', () => {
  it('pide repo, lenguajes, README y última release con las cabeceras recomendadas y el token', async () => {
    const { fetchImpl, calls } = fakeFetch({
      '/repos/pgvector/pgvector': () => Response.json(REPO),
      '/repos/pgvector/pgvector/languages': () => Response.json({ C: 412000, Makefile: 3000 }),
      '/repos/pgvector/pgvector/readme': () => new Response('# pgvector\n'),
      '/repos/pgvector/pgvector/releases/latest': () =>
        Response.json({ tag_name: 'v0.8.0', published_at: '2024-10-30T00:00:00Z' }),
    })
    const provider = new RestGitHubProvider({ token: 'ghp_de_prueba', fetchImpl })
    const data = await provider.fetchRepository('pgvector', 'pgvector')

    expect(data).toMatchObject({
      githubRepositoryId: 359005955,
      fullName: 'pgvector/pgvector',
      owner: 'pgvector',
      license: 'PostgreSQL',
      homepage: null,
      topics: ['postgres', 'vector'],
      languages: { C: 412000, Makefile: 3000 },
      readme: '# pgvector\n',
      latestRelease: 'v0.8.0',
    })
    // Las fechas van separadas: la última actividad es pushed_at, no updated_at.
    expect(data.githubPushedAt?.toISOString()).toBe('2026-09-11T08:00:00.000Z')
    expect(data.githubUpdatedAt?.toISOString()).toBe('2026-09-12T10:04:00.000Z')
    expect(data.latestReleaseAt?.toISOString()).toBe('2024-10-30T00:00:00.000Z')

    expect(calls.map((c) => new URL(c.url).pathname).sort()).toEqual([
      '/repos/pgvector/pgvector',
      '/repos/pgvector/pgvector/languages',
      '/repos/pgvector/pgvector/readme',
      '/repos/pgvector/pgvector/releases/latest',
    ])
    for (const c of calls) {
      expect(new URL(c.url).origin).toBe('https://api.github.com')
      expect(c.headers['X-GitHub-Api-Version']).toBe('2022-11-28')
      expect(c.headers.Authorization).toBe('Bearer ghp_de_prueba')
    }
    // Y el token no aparece en lo que sale hacia la aplicación.
    expect(JSON.stringify(data)).not.toContain('ghp_de_prueba')
  })

  it('un repositorio sin README ni releases se guarda igual, con nulos', async () => {
    const { fetchImpl } = fakeFetch({
      '/repos/pgvector/pgvector': () => Response.json(REPO),
      '/repos/pgvector/pgvector/languages': () => Response.json({}),
    })
    const data = await new RestGitHubProvider({ fetchImpl }).fetchRepository('pgvector', 'pgvector')
    expect(data.readme).toBeNull()
    expect(data.latestRelease).toBeNull()
    expect(data.latestReleaseAt).toBeNull()
  })

  it('una licencia NOASSERTION se guarda como desconocida', async () => {
    const { fetchImpl } = fakeFetch({
      '/repos/pgvector/pgvector': () =>
        Response.json({ ...REPO, license: { spdx_id: 'NOASSERTION' } }),
    })
    const data = await new RestGitHubProvider({ fetchImpl }).fetchRepository('pgvector', 'pgvector')
    expect(data.license).toBeNull()
  })

  it('un 404 de GitHub es RepositoryNotFoundError (privado o inexistente)', async () => {
    const { fetchImpl } = fakeFetch({})
    await expect(
      new RestGitHubProvider({ fetchImpl }).fetchRepository('nadie', 'no-existe'),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError)
  })

  it('un 403 por límite lee la ventana y no vuelve a llamar hasta que pase', async () => {
    let now = 1_000_000_000_000
    const { fetchImpl, calls } = fakeFetch({
      '/repos/limite/limite': () =>
        new Response('rate limited', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(now / 1000) + 120),
          },
        }),
    })
    const provider = new RestGitHubProvider({ fetchImpl, now: () => now })

    await expect(provider.fetchRepository('limite', 'limite')).rejects.toBeInstanceOf(
      GitHubRateLimitError,
    )
    expect(provider.rateLimitedUntil()?.getTime()).toBe(now + 120_000)

    // Dentro de la ventana: mismo error y ninguna petición nueva.
    await expect(provider.fetchRepository('limite', 'limite')).rejects.toBeInstanceOf(
      GitHubRateLimitError,
    )
    expect(calls).toHaveLength(1)

    // Pasada la ventana, vuelve a intentarlo.
    now += 121_000
    await expect(provider.fetchRepository('limite', 'limite')).rejects.toBeInstanceOf(
      GitHubRateLimitError,
    )
    expect(calls).toHaveLength(2)
  })

  it('un límite en la llamada de lenguajes o README no se traga: es GitHubRateLimitError', async () => {
    const { fetchImpl } = fakeFetch({
      '/repos/pgvector/pgvector': () => Response.json(REPO),
      '/repos/pgvector/pgvector/languages': () =>
        new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    })
    await expect(
      new RestGitHubProvider({ fetchImpl }).fetchRepository('pgvector', 'pgvector'),
    ).rejects.toBeInstanceOf(GitHubRateLimitError)
  })

  it('un 429 con retry-after también bloquea', async () => {
    const now = 5_000_000
    const { fetchImpl } = fakeFetch({
      '/repos/a/b': () => new Response('', { status: 429, headers: { 'retry-after': '30' } }),
    })
    const provider = new RestGitHubProvider({ fetchImpl, now: () => now })
    await expect(provider.fetchRepository('a', 'b')).rejects.toBeInstanceOf(GitHubRateLimitError)
    expect(provider.rateLimitedUntil()?.getTime()).toBe(now + 30_000)
  })
})
