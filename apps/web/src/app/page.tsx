import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'

// La raíz no es una pantalla: con sesión, la biblioteca; sin ella, el acceso.
export default async function Home() {
  const user = await currentUser()
  redirect(user ? '/library' : '/login')
}
