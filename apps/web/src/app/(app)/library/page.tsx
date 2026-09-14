import { redirect } from 'next/navigation'
import { ValidationError, libraryQuerySchema, zodToErrors } from '@rgm/shared'
import { LibraryView } from '@/components/library-view'
import { repeatedParam } from '@/lib/http'
import { currentUser } from '@/lib/session'
import { listLibraryCategories, listUserRepositories } from '@/modules/repositories/service'

export const dynamic = 'force-dynamic'

/**
 * La biblioteca, privada: el layout ya exige sesión y aquí se lee la lista de
 * la cuenta desde el servidor, con el orden y los filtros de la URL
 * validados por el mismo esquema que la API. Un valor fuera del dominio no
 * se ignora: se dice y se lista con los valores por defecto. Una categoría
 * que el catálogo no conoce también se dice, y se lista sin ella con el resto
 * de filtros.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await currentUser()
  if (!user) redirect('/login')
  const entries = Object.entries(await searchParams)
  // Un parámetro repetido tampoco se ignora quedándose con uno: igual que la
  // API responde 422, se dice y se lista con los valores por defecto.
  const repeated = entries.filter(([, v]) => Array.isArray(v) && v.length > 1).map(([k]) => k)
  const raw = Object.fromEntries(entries.map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  const parsed = repeated.length ? null : libraryQuerySchema.safeParse(raw)
  let query = parsed?.success ? parsed.data : libraryQuerySchema.parse({})
  let queryError = parsed?.success
    ? null
    : (parsed ? zodToErrors(parsed.error) : repeated.map(repeatedParam))
        .map((e) => `${e.field}: ${e.message}`)
        .join('; ')

  const categories = await listLibraryCategories(user.id)
  let list
  try {
    list = await listUserRepositories(user.id, query)
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    // Solo la categoría es lo que el servicio rechaza: el resto de filtros ya
    // validó y se conserva.
    queryError = error.items.map((e) => `${e.field}: ${e.message}`).join('; ')
    query = { ...query, category: undefined }
    list = await listUserRepositories(user.id, query)
  }
  return (
    <LibraryView
      initial={list.items}
      total={list.meta.total}
      query={query}
      queryError={queryError}
      categories={categories}
    />
  )
}
