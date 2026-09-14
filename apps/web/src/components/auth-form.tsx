'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { loginSchema, registerSchema, zodToErrors } from '@rgm/shared'
import { ApiError, api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Mode = 'login' | 'register'

const copy = {
  login: {
    title: 'Entrar',
    action: 'Entrar',
    alternate: { text: '¿No tienes cuenta?', link: '/register', label: 'Crear una' },
  },
  register: {
    title: 'Crear cuenta',
    action: 'Crear cuenta',
    alternate: { text: '¿Ya tienes cuenta?', link: '/login', label: 'Entrar' },
  },
} as const

/**
 * Registro y acceso comparten formulario: los mismos esquemas Zod que el
 * backend validan antes de enviar, y los errores del servidor caen en el
 * campo que les corresponde. Mientras se envía, el botón lo dice.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [fields, setFields] = useState({ email: '', password: '', passwordConfirmation: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const set = (name: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [name]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setGeneral(null)
    const schema = mode === 'register' ? registerSchema : loginSchema
    const parsed = schema.safeParse(fields)
    if (!parsed.success) {
      setErrors(Object.fromEntries(zodToErrors(parsed.error).map((x) => [x.field, x.message])))
      return
    }
    setErrors({})
    setSending(true)
    try {
      if (mode === 'register') await api.register(fields)
      else await api.login({ email: fields.email, password: fields.password })
      router.push('/library')
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors)
        if (!Object.keys(error.fieldErrors).length) setGeneral(error.message)
      } else {
        setGeneral('Algo falló. Inténtalo de nuevo.')
      }
    } finally {
      setSending(false)
    }
  }

  const c = copy[mode]
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <Card>
        <h1 className="mb-1 text-2xl font-semibold">{c.title}</h1>
        <p className="mb-6 text-sm text-muted">Tu biblioteca personal de repositorios de GitHub.</p>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={set('email')}
            error={errors.email}
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={fields.password}
            onChange={set('password')}
            error={errors.password}
          />
          {mode === 'register' ? (
            <Input
              label="Repite la contraseña"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              value={fields.passwordConfirmation}
              onChange={set('passwordConfirmation')}
              error={errors.passwordConfirmation}
            />
          ) : null}
          {general ? (
            <p role="alert" className="text-sm text-danger">
              {general}
            </p>
          ) : null}
          <Button type="submit" disabled={sending}>
            {sending ? 'Enviando…' : c.action}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          {c.alternate.text}{' '}
          <Link href={c.alternate.link} className="text-accent underline">
            {c.alternate.label}
          </Link>
        </p>
      </Card>
    </main>
  )
}
