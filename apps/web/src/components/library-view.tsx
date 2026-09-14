'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import type { Category, LibraryQuery, UserRepository } from '@rgm/shared'
import { ApiError, api } from '@/lib/api'
import { AnalysisPoller } from '@/components/analysis-status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LibraryFilters } from '@/components/library-filters'
import { RepositoryCard } from '@/components/repository-card'

/**
 * La biblioteca: el campo «Pega una URL de GitHub» como primera acción, el
 * orden y los filtros en la URL, y las tarjetas de lo guardado. Guardar
 * responde con la metadata ya presente; el resumen de IA llega después
 * (specs/repositories · «Guardar responde antes que la IA»). Un repositorio
 * que ya estaba se dice, no se duplica (specs/repositories · «Ya está en mi
 * biblioteca»). Mientras alguna tarjeta tenga el análisis en camino, la lista
 * se vuelve a leer sola hasta que llegue.
 */
export function LibraryView({
  initial,
  total,
  query,
  queryError,
  categories,
}: {
  initial: UserRepository[]
  total: number
  query: LibraryQuery
  queryError: string | null
  categories: Category[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Cambiar el orden o un filtro trae otra lista del servidor: el estado se
  // ajusta durante el render, sin efecto.
  const [previous, setPrevious] = useState(initial)
  if (initial !== previous) {
    setPrevious(initial)
    setItems(initial)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!url.trim()) {
      setError('Pega la URL de un repositorio de GitHub')
      return
    }
    setSaving(true)
    try {
      const { item, created } = await api.saveRepository({ url: url.trim() })
      // Con un filtro activo no se antepone: un repositorio nace NEW y no
      // tiene por qué cumplirlo. Sin filtro se antepone al momento. En los
      // dos casos se relee del servidor: un repositorio ya analizado llega
      // con categorías que el filtro de categoría todavía no ofrecía.
      if (!filtered) setItems((list) => [item, ...list.filter((x) => x.id !== item.id)])
      router.refresh()
      setNotice(
        created
          ? `Guardado ${item.repository.fullName}`
          : `${item.repository.fullName} ya está en tu biblioteca`,
      )
      setUrl('')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fieldErrors.url ?? err.message)
          : 'Algo falló. Inténtalo de nuevo.',
      )
    } finally {
      setSaving(false)
    }
  }

  const count = Math.max(total, items.length)
  // Cualquier filtro activo, no solo los que tienen control en pantalla: la
  // API acepta también language, license y minStars por la URL.
  const filtered =
    query.status !== undefined ||
    query.favorite !== undefined ||
    query.category !== undefined ||
    query.language !== undefined ||
    query.license !== undefined ||
    query.minStars !== undefined

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* La biblioteca es la pantalla de inicio (specs/auth) y el buscador es
          lo primero que se ve en ella (specs/search · CA-4). Formulario GET
          nativo: lleva a /search?q= con o sin JavaScript. */}
      <form role="search" action="/search" method="get" className="mb-6 flex gap-2">
        <label htmlFor="inicio-q" className="sr-only">
          Buscar en tus repositorios
        </label>
        <input
          id="inicio-q"
          name="q"
          type="search"
          required
          minLength={2}
          autoComplete="off"
          placeholder="¿Qué tipo de herramienta necesitas?"
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-accent sm:text-lg"
        />
        <Button type="submit" className="min-h-12 gap-2" aria-label="Buscar">
          <Search size={18} aria-hidden /> <span className="hidden sm:inline">Buscar</span>
        </Button>
      </form>
      <h1 className="mb-6 text-2xl font-semibold">Tu biblioteca</h1>
      <AnalysisPoller pending={items.some((i) => i.repository.analysis.status === 'PENDING')} />

      <form
        onSubmit={save}
        noValidate
        className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            label="Pega una URL de GitHub"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={error ?? undefined}
          />
        </div>
        <Button type="submit" disabled={saving} className="sm:mb-0">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
      {notice ? (
        <p role="status" className="mb-4 text-sm text-muted">
          {notice}
        </p>
      ) : null}

      {items.length > 0 || filtered ? (
        <LibraryFilters query={query} categories={categories} />
      ) : null}
      {queryError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          Orden o filtro no válido ({queryError}); se muestra la biblioteca por defecto.
        </p>
      ) : null}

      {items.length === 0 ? (
        <Card>
          {filtered ? (
            <p className="text-sm text-muted">Nada con ese filtro.</p>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-medium">
                Todavía no has guardado ningún repositorio
              </h2>
              <p className="text-sm text-muted">
                Esta es tu biblioteca personal de repositorios de GitHub. Pega la URL de uno arriba
                y lo verás aquí con sus estrellas, su licencia y su última actividad. Nadie más ve
                lo que guardas ni lo que anotas.
              </p>
            </>
          )}
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {count} {count === 1 ? 'repositorio' : 'repositorios'}
          </p>
          <ul
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Repositorios guardados"
          >
            {items.map((item) => (
              <li key={item.id}>
                <RepositoryCard item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
