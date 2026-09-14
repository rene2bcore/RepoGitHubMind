'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { PERSONAL_STATUSES, type Personal, type PersonalUpdateBody } from '@rgm/shared'
import { ApiError, api } from '@/lib/api'
import { STATUS_LABELS } from '@/components/repository-card'

/**
 * Estado y favorito, cambiables desde la tarjeta sin abrir el detalle
 * (specs/library · «Cambio desde la tarjeta»): la interfaz refleja el cambio
 * al momento y, si el servidor lo rechaza, vuelve al valor real y avisa. El
 * valor de verdad es siempre el que el servidor relee de la base.
 */
export function PersonalControls({
  id,
  personal,
  onChange,
}: {
  id: string
  personal: Personal
  onChange?: (personal: Personal) => void
}) {
  const [current, setCurrent] = useState(personal)
  const [error, setError] = useState<string | null>(null)

  async function patch(body: PersonalUpdateBody) {
    const before = current
    setError(null)
    setCurrent({ ...current, ...body } as Personal)
    try {
      const item = await api.updatePersonal(id, body)
      setCurrent(item.personal)
      onChange?.(item.personal)
    } catch (err) {
      setCurrent(before)
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`status-${id}`}>
        Estado
      </label>
      <select
        id={`status-${id}`}
        value={current.status}
        onChange={(e) => patch({ status: e.target.value as Personal['status'] })}
        className="min-h-9 rounded-md border border-border bg-card px-2 text-xs"
      >
        {PERSONAL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-pressed={current.favorite}
        aria-label={current.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
        onClick={() => patch({ favorite: !current.favorite })}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card aria-pressed:text-danger"
      >
        <Heart size={16} fill={current.favorite ? 'currentColor' : 'none'} />
      </button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  )
}
