import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { currentUser } from '@/lib/session'

export default async function RegisterPage() {
  if (await currentUser()) redirect('/library')
  return <AuthForm mode="register" />
}
