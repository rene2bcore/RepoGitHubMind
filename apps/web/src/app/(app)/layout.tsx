import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { currentUser } from '@/lib/session'

// Toda pantalla privada cuelga de aquí: sin sesión, al acceso, sin datos.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect('/login')
  return <AppShell email={user.email}>{children}</AppShell>
}
