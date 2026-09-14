'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api'

/**
 * «Análisis no disponible · Reintentar» (specs/ai · «La IA nunca impide
 * guardar»): pide otra vez el análisis y recarga los datos del servidor, que
 * es quien dice el estado real.
 */
export function AnalysisRetry({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function retry() {
    setBusy(true)
    setError(null)
    try {
      await api.requestAnalysis(id)
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo pedir el análisis')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {' · '}
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="text-accent underline disabled:opacity-60"
      >
        {busy ? 'Pidiendo…' : 'Reintentar'}
      </button>
      {error ? (
        <span role="alert" className="ml-1 text-danger">
          {error}
        </span>
      ) : null}
    </>
  )
}

const POLL_MS = 3_000
const MAX_POLLS = 40

/**
 * Mientras haya un análisis en camino, vuelve a leer la página del servidor
 * cada pocos segundos durante un par de minutos: el resumen aparece sin
 * recargar ni volver a guardar (specs/repositories · «El repositorio aparece
 * antes que su resumen»).
 */
export function AnalysisPoller({ pending }: { pending: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!pending) return
    let polls = 0
    const timer = setInterval(() => {
      polls += 1
      if (polls > MAX_POLLS) clearInterval(timer)
      else router.refresh()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [pending, router])
  return null
}
