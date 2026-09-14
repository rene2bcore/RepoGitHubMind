'use client'

import { useState, type FormEvent } from 'react'
import type { Personal } from '@rgm/shared'
import { ApiError, api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PersonalControls } from '@/components/personal-controls'

/**
 * Mis datos sobre un repositorio, en el detalle (specs/library · «Rating y
 * notas»): estado y favorito con los mismos controles que la tarjeta, rating
 * de 1 a 5 o ninguno, y notas de hasta 4000 caracteres. Lo que se muestra
 * tras guardar es lo que el servidor releyó.
 */
export function PersonalEditor({ id, personal: initial }: { id: string; personal: Personal }) {
  const [personal, setPersonal] = useState(initial)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [rating, setRating] = useState<number | null>(initial.rating)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const item = await api.updatePersonal(id, {
        rating,
        notes: notes.trim() === '' ? null : notes.trim(),
      })
      setPersonal(item.personal)
      setNotes(item.personal.notes ?? '')
      setRating(item.personal.rating)
      setMessage('Guardado')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3" aria-label="Mis datos">
      <PersonalControls id={id} personal={personal} onChange={setPersonal} />
      <fieldset className="flex items-center gap-1">
        <legend className="mb-1 text-sm font-medium">Rating</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} de 5`}
            aria-pressed={rating !== null && n <= rating}
            onClick={() => setRating(rating === n ? null : n)}
            className="min-h-9 min-w-9 text-lg text-muted aria-pressed:text-accent"
          >
            {rating !== null && n <= rating ? '★' : '☆'}
          </button>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Notas
        <textarea
          name="notes"
          value={notes}
          maxLength={4000}
          rows={4}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border border-border bg-card p-2 text-base font-normal outline-none focus:ring-2 focus:ring-accent"
          placeholder="Para qué lo guardaste, qué probaste, qué te pareció"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar mis datos'}
        </Button>
        {message ? (
          <span role="status" className="text-sm text-muted">
            {message}
          </span>
        ) : null}
      </div>
    </form>
  )
}
