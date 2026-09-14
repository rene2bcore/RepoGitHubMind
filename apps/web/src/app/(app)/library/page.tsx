import { redirect } from 'next/navigation'
import { libraryQuerySchema, zodToErrors } from '@rgm/shared'
import { LibraryView } from '@/components/library-view'
import { currentUser } from '@/lib/session'
import { listUserRepositories } from '@/modules/repositories/service'

export const dynamic = 'force-dynamic'

/**
 * La biblioteca, privada: el layout ya exige sesión y aquí se lee la lista de
 * la cuenta desde el servidor, con el orden y los filtros de la URL
 * validados por el mismo esquema que la API. Un valor fuera del dominio no
 * se ignora: se dice y se lista con los valores por defecto.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await currentUser()
  if (!user) redirect('/login')
  const raw = Object.fromEntries(
    Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  )
  const parsed = libraryQuerySchema.safeParse(raw)
  const query = parsed.success ? parsed.data : libraryQuerySchema.parse({})
  const queryError = parsed.success
    ? null
    : zodToErrors(parsed.error)
        .map((e) => `${e.field}: ${e.message}`)
        .join('; ')
  const { items, meta } = await listUserRepositories(user.id, query)
  return <LibraryView initial={items} total={meta.total} query={query} queryError={queryError} />
}
