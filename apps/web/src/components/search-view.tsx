'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import {
  PERSONAL_STATUSES,
  type Repository,
  type SearchMeta,
  type SearchResult,
  type SearchScopeName,
} from '@rgm/shared'
import { ApiError, api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { STATUS_LABELS, formatStars, relativeTime } from '@/components/repository-card'
import type { SearchFacets } from '@/modules/search/service'

const MIN_STARS = ['100', '1000', '10000'] as const
const FILTERS = ['category', 'language', 'license', 'minStars', 'status', 'favorite'] as const

/**
 * «Activo», «Poco activo», «Inactivo» o «Archivado», de la heurística sobre el
 * último push (specs/ai · «Riesgo de abandono»). Si la valoración no es
 * heurística no hay datos de actividad, y se dice así.
 */
export function activityLabel(repository: Repository): string {
  if (repository.archived) return 'Archivado'
  if (repository.analysis.abandonmentRiskSource !== 'HEURISTIC') return 'Actividad desconocida'
  return {
    LOW: 'Activo',
    MEDIUM: 'Poco activo',
    HIGH: 'Inactivo',
    UNKNOWN: 'Actividad desconocida',
  }[repository.analysis.abandonmentRisk]
}

/**
 * La pantalla de búsqueda (specs/search · «Resultado legible»): el buscador
 * primero, con «¿Qué tipo de herramienta necesitas?»; el ámbito y los
 * filtros debajo, en la URL; y cada resultado en una línea con nombre,
 * categoría, estrellas, licencia y actividad, y su «Por qué» debajo. Lo que
 * está en mi biblioteca enlaza a su detalle; lo demás, a GitHub, con
 * «Guardar».
 */
export function SearchView({
  params,
  scope,
  facets,
  result,
  error,
}: {
  params: Record<string, string | undefined>
  scope: SearchScopeName
  facets: SearchFacets
  result: { items: SearchResult[]; meta: SearchMeta } | null
  error: string | null
}) {
  const router = useRouter()
  const q = params.q?.trim() ?? ''

  function navigate(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...params, ...changes })) {
      if (value) next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `/search?${qs}` : '/search')
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('q')
    navigate({ q: typeof value === 'string' ? value.trim() : undefined })
  }

  const licenses = new Set((params.license ?? '').split(',').filter(Boolean))
  function toggleLicense(license: string, checked: boolean) {
    if (checked) licenses.add(license)
    else licenses.delete(license)
    navigate({ license: [...licenses].join(',') || undefined })
  }

  const active = FILTERS.filter((f) => params[f])
  const select = 'min-h-9 rounded-md border border-border bg-card px-2 text-sm'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="sr-only">Buscar</h1>
      <form role="search" onSubmit={submit} className="mb-4 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar repositorios
        </label>
        <input
          key={q}
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          autoComplete="off"
          placeholder="¿Qué tipo de herramienta necesitas?"
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-accent sm:text-lg"
        />
        <Button type="submit" className="min-h-12 gap-2" aria-label="Buscar">
          <Search size={18} aria-hidden /> <span className="hidden sm:inline">Buscar</span>
        </Button>
      </form>

      <fieldset className="mb-3 flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">Dónde buscar</legend>
        {(
          [
            ['library', 'Mi biblioteca'],
            ['global', 'Todo RepoGitHubMind'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-9 items-center gap-2">
            <input
              type="radio"
              name="scope"
              value={value}
              checked={scope === value}
              onChange={() =>
                navigate(
                  value === 'global'
                    ? { scope: 'global', status: undefined, favorite: undefined }
                    : { scope: undefined },
                )
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      <details className="mb-4" open={active.length > 0}>
        <summary className="min-h-9 cursor-pointer text-sm text-muted">
          Filtros{active.length ? ` (${active.length})` : ''}
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3" aria-label="Filtros">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Categoría
            <select
              aria-label="Categoría"
              className={select}
              value={params.category ?? ''}
              onChange={(e) => navigate({ category: e.target.value || undefined })}
            >
              <option value="">Todas</option>
              {params.category && !facets.categories.some((c) => c.slug === params.category) ? (
                <option value={params.category}>{params.category}</option>
              ) : null}
              {facets.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {'  '.repeat(c.path.split('/').length - 1)}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Lenguaje
            <select
              className={select}
              value={params.language ?? ''}
              onChange={(e) => navigate({ language: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {params.language && !facets.languages.includes(params.language) ? (
                <option value={params.language}>{params.language}</option>
              ) : null}
              {facets.languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Estrellas
            <select
              className={select}
              value={params.minStars ?? ''}
              onChange={(e) => navigate({ minStars: e.target.value || undefined })}
            >
              <option value="">Cualquiera</option>
              {params.minStars && !MIN_STARS.includes(params.minStars as never) ? (
                <option value={params.minStars}>Desde {params.minStars}</option>
              ) : null}
              {MIN_STARS.map((n) => (
                <option key={n} value={n}>
                  Desde {formatStars(Number(n))}
                </option>
              ))}
            </select>
          </label>
          {scope === 'library' ? (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Estado
                <select
                  className={select}
                  value={params.status ?? ''}
                  onChange={(e) => navigate({ status: e.target.value || undefined })}
                >
                  <option value="">Todos</option>
                  {PERSONAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={params.favorite === 'true'}
                  onChange={(e) => navigate({ favorite: e.target.checked ? 'true' : undefined })}
                />
                Solo favoritos
              </label>
            </>
          ) : null}
          {facets.licenses.length || licenses.size ? (
            <fieldset className="flex w-full flex-wrap gap-x-4 gap-y-1 text-sm">
              <legend className="mb-1 text-xs text-muted">Licencia</legend>
              {[...new Set([...facets.licenses, ...licenses])].map((license) => (
                <label key={license} className="flex min-h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={licenses.has(license)}
                    onChange={(e) => toggleLicense(license, e.target.checked)}
                  />
                  {license}
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      </details>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!q ? (
        <Card>
          <p className="text-sm text-muted">
            Pregunta con tus palabras, en castellano o en inglés: «vectores en postgres», «memoria
            para agentes», «editor de texto en C». Busca por significado, no solo por palabras
            exactas, en tu biblioteca o en todos los repositorios que conoce RepoGitHubMind.
          </p>
        </Card>
      ) : result && result.items.length === 0 ? (
        <Card>
          <h2 className="mb-2 text-lg font-medium">Nada para «{q}»</h2>
          <p className="text-sm text-muted">
            {active.length ? 'Prueba a quitar filtros' : 'Prueba con otras palabras'}
            {scope === 'library' ? (
              <>
                {' o '}
                <button
                  type="button"
                  className="text-accent underline"
                  onClick={() =>
                    navigate({ scope: 'global', status: undefined, favorite: undefined })
                  }
                >
                  busca en todo RepoGitHubMind
                </button>
              </>
            ) : null}
            .
          </p>
        </Card>
      ) : result ? (
        <>
          <p className="mb-3 text-sm text-muted" role="status">
            {result.items.length} {result.items.length === 1 ? 'resultado' : 'resultados'}
            {result.meta.mode === 'lexical'
              ? ' · solo por palabras: la búsqueda por significado no está disponible ahora'
              : null}
          </p>
          <ol className="flex flex-col gap-3" aria-label="Resultados">
            {result.items.map((item) => (
              <li key={item.repository.id}>
                <SearchResultCard item={item} />
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </main>
  )
}

function SearchResultCard({ item }: { item: SearchResult }) {
  const r = item.repository
  const name = `${r.owner} / ${r.name}`
  return (
    <Card className="flex flex-col gap-1.5 p-4" data-testid="search-result">
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
        {item.id ? (
          <Link href={`/repositories/${item.id}`} className="font-medium break-all hover:underline">
            {name}
          </Link>
        ) : (
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium break-all hover:underline"
          >
            {name}
          </a>
        )}
        {r.categories.length ? (
          <span className="text-muted">· {r.categories.map((c) => c.name).join(', ')}</span>
        ) : null}
        <span className="text-muted" aria-label={`${r.stars} estrellas`}>
          · ⭐ {formatStars(r.stars)}
        </span>
        {r.license ? <span className="text-muted">· {r.license}</span> : null}
        <span className="text-muted" title={`Última actividad ${relativeTime(r.githubPushedAt)}`}>
          · {activityLabel(r)}
        </span>
      </p>
      <p className="text-sm">
        <span className="font-medium">Por qué:</span>{' '}
        <span className="text-muted">{item.match.reason}</span>
      </p>
      <p className="text-xs text-muted">
        {item.personal ? (
          <>
            En tu biblioteca · {STATUS_LABELS[item.personal.status]}
            {item.personal.favorite ? ' · Favorito' : null}
          </>
        ) : (
          <SaveFromSearch url={r.url} fullName={r.fullName} />
        )}
      </p>
    </Card>
  )
}

function SaveFromSearch({ url, fullName }: { url: string; fullName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveIt() {
    setBusy(true)
    setError(null)
    try {
      await api.saveRepository({ url, source: 'search' })
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
      setBusy(false)
    }
  }

  return (
    <>
      No está en tu biblioteca ·{' '}
      <button
        type="button"
        onClick={saveIt}
        disabled={busy}
        aria-label={`Guardar ${fullName}`}
        className="text-accent underline disabled:opacity-60"
      >
        {busy ? 'Guardando…' : '+ Guardar'}
      </button>
      {error ? (
        <span role="alert" className="ml-1 text-danger">
          {error}
        </span>
      ) : null}
    </>
  )
}
