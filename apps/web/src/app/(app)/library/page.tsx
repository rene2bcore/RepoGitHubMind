import { redirect } from 'next/navigation'
import { libraryQuerySchema } from '@rgm/shared'
import { LibraryView } from '@/components/library-view'
import { currentUser } from '@/lib/session'
import { listUserRepositories } from '@/modules/repositories/service'

export const dynamic = 'force-dynamic'

/**
 * La biblioteca, privada: el layout ya exige sesión y aquí se lee la lista de
 * la cuenta desde el servidor, con los mismos parámetros validados que la
 * API. Guardar y el resto de acciones van por `lib/api.ts` en el cliente.
 */
export default async function LibraryPage() {
  const user = await currentUser()
  if (!user) redirect('/login')
  const { items, meta } = await listUserRepositories(user.id, libraryQuerySchema.parse({}))
  return <LibraryView initial={items} total={meta.total} />
}
