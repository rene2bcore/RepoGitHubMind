'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Library, LogOut, Search } from 'lucide-react'
import { api, onUnauthorized } from '@/lib/api'

const nav = [
  { href: '/library', label: 'Biblioteca', icon: Library },
  { href: '/search', label: 'Buscar', icon: Search },
] as const

/**
 * Navegación: inferior en móvil, lateral en escritorio (prompt maestro §31,
 * §67). Si cualquier llamada a la API responde 401, la sesión ya no vale y
 * se vuelve al acceso explicando por qué.
 */
export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(
    () =>
      onUnauthorized(() => {
        router.push('/login?motivo=sesion')
        router.refresh()
      }),
    [router],
  )

  async function logout() {
    await api.logout().catch(() => {})
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden w-60 flex-col border-r border-border p-4 md:flex">
        <Link href="/library" className="mb-6 text-lg font-semibold">
          RepoGitHubMind
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? 'page' : undefined}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-card aria-[current=page]:bg-card aria-[current=page]:font-medium"
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-sm text-muted">
          <span className="truncate" title={email}>
            {email}
          </span>
          <button onClick={logout} className="flex items-center gap-2 text-left hover:text-fg">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-bg md:hidden">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? 'page' : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs aria-[current=page]:text-accent"
          >
            <Icon size={20} /> {label}
          </Link>
        ))}
        <button
          onClick={logout}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs"
        >
          <LogOut size={20} /> Salir
        </button>
      </nav>
    </div>
  )
}
