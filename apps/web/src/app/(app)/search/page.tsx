import { redirect } from 'next/navigation'
import {
  RateLimitError,
  ValidationError,
  searchQuerySchema,
  zodToErrors,
  type SearchMeta,
  type SearchResult,
} from '@rgm/shared'
import { SearchView } from '@/components/search-view'
import { checkRateLimit } from '@/lib/rate-limit'
import { currentUser } from '@/lib/session'
import { listSearchFacets, searchRepositories } from '@/modules/search/service'

export const dynamic = 'force-dynamic'

/**
 * La búsqueda, con la consulta y los filtros en la URL (specs/search ·
 * «Filtros combinables en la URL»): una búsqueda se comparte copiando la URL
 * y el botón «atrás» la deshace. Se valida con el mismo esquema que la API y
 * cuenta en el mismo límite por cuenta que `GET /api/v1/search`, porque cada
 * búsqueda puede costar una llamada de embeddings. Sin consulta, el buscador
 * y nada más.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await currentUser()
  if (!user) redirect('/login')
  const params = Object.fromEntries(
    Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>
  const scope = params.scope === 'global' ? 'global' : 'library'
  const facets = await listSearchFacets(user.id, scope)

  let result: { items: SearchResult[]; meta: SearchMeta } | null = null
  let error: string | null = null
  if (params.q?.trim()) {
    const parsed = searchQuerySchema.safeParse(params)
    if (!parsed.success) {
      error = zodToErrors(parsed.error)
        .map((e) => (e.field === 'q' ? e.message : `${e.field}: ${e.message}`))
        .join('; ')
    } else {
      try {
        checkRateLimit(`search:${user.id}`)
        result = await searchRepositories(user.id, parsed.data)
      } catch (caught) {
        if (caught instanceof ValidationError) {
          error = caught.items.map((e) => `${e.field}: ${e.message}`).join('; ')
        } else if (caught instanceof RateLimitError) {
          error = caught.message
        } else {
          throw caught
        }
      }
    }
  }
  return <SearchView params={params} scope={scope} facets={facets} result={result} error={error} />
}
