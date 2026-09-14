import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { currentUser } from '@/lib/session'

// Con sesión, /login no tiene sentido: a la biblioteca.
export default async function LoginPage() {
  if (await currentUser()) redirect('/library')
  return <AuthForm mode="login" />
}
