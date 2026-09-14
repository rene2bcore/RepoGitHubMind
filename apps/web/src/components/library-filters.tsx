'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LIBRARY_SORTS, PERSONAL_STATUSES, type Category, type LibraryQuery } from '@rgm/shared'
import { STATUS_LABELS } from '@/components/repository-card'

const SORT_LABELS: Record<(typeof LIBRARY_SORTS)[number], string> = {
  savedAt: 'Guardado',
  pushedAt: 'Actividad',
  stars: 'Estrellas',
  name: 'Nombre',
  rating: 'Rating',
}

/**
 * Orden y filtros de la biblioteca, que viajan en la URL (specs/library ·
 * «Lista con orden y filtros»): la página del servidor los lee y los valida
 * con el mismo esquema que la API. Cambiarlos es una navegación suave, sin
 * recargar. Las categorías son las de la biblioteca con sus ramas, sangradas
 * por profundidad: elegir una rama filtra también sus hojas.
 */
export function LibraryFilters({
  query,
  categories,
}: {
  query: LibraryQuery
  categories: Category[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function set(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('page')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const select = 'min-h-9 rounded-md border border-border bg-card px-2 text-sm'
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3" aria-label="Orden y filtros">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Ordenar por
        <select className={select} value={query.sort} onChange={(e) => set('sort', e.target.value)}>
          {LIBRARY_SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Estado
        <select
          className={select}
          value={query.status ?? ''}
          onChange={(e) => set('status', e.target.value)}
        >
          <option value="">Todos</option>
          {PERSONAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {categories.length || query.category ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Categoría
          <select
            aria-label="Categoría"
            className={select}
            value={query.category ?? ''}
            onChange={(e) => set('category', e.target.value)}
          >
            <option value="">Todas</option>
            {query.category && !categories.some((c) => c.slug === query.category) ? (
              <option value={query.category}>{query.category}</option>
            ) : null}
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {'  '.repeat(c.path.split('/').length - 1)}
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={query.favorite === true}
          onChange={(e) => set('favorite', e.target.checked ? 'true' : '')}
        />
        Solo favoritos
      </label>
    </div>
  )
}
