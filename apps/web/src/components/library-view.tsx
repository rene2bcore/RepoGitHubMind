'use client'

import { useState, type FormEvent } from 'react'
import type { UserRepository } from '@rgm/shared'
import { ApiError, api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RepositoryCard } from '@/components/repository-card'

/**
 * La biblioteca de H2: el campo «Pega una URL de GitHub» como primera acción
 * y las tarjetas de lo guardado. Guardar responde con la metadata ya
 * presente; el resumen de IA llega después (specs/repositories · «Guardar
 * responde antes que la IA»). Un repositorio que ya estaba se dice, no se
 * duplica (specs/repositories · «Ya está en mi biblioteca»).
 */
export function LibraryView({ initial, total }: { initial: UserRepository[]; total: number }) {
  const [items, setItems] = useState(initial)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!url.trim()) {
      setError('Pega la URL de un repositorio de GitHub')
      return
    }
    setSaving(true)
    try {
      const { item, created } = await api.saveRepository({ url: url.trim() })
      setItems((list) => [item, ...list.filter((x) => x.id !== item.id)])
      setNotice(
        created
          ? `Guardado ${item.repository.fullName}`
          : `${item.repository.fullName} ya está en tu biblioteca`,
      )
      setUrl('')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fieldErrors.url ?? err.message)
          : 'Algo falló. Inténtalo de nuevo.',
      )
    } finally {
      setSaving(false)
    }
  }

  const count = Math.max(total, items.length)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Tu biblioteca</h1>

      <form
        onSubmit={save}
        noValidate
        className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            label="Pega una URL de GitHub"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={error ?? undefined}
          />
        </div>
        <Button type="submit" disabled={saving} className="sm:mb-0">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
      {notice ? (
        <p role="status" className="mb-4 text-sm text-muted">
          {notice}
        </p>
      ) : null}

      {items.length === 0 ? (
        <Card>
          <h2 className="mb-2 text-lg font-medium">Todavía no has guardado ningún repositorio</h2>
          <p className="text-sm text-muted">
            Esta es tu biblioteca personal de repositorios de GitHub. Pega la URL de uno arriba y lo
            verás aquí con sus estrellas, su licencia y su última actividad. Nadie más ve lo que
            guardas ni lo que anotas.
          </p>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {count} {count === 1 ? 'repositorio' : 'repositorios'}
          </p>
          <ul
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Repositorios guardados"
          >
            {items.map((item) => (
              <li key={item.id}>
                <RepositoryCard item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
