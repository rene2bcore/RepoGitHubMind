import type { UserRepository } from '@rgm/shared'
import { Card } from '@/components/ui/card'

/** 19400 -> «19,4k», 980 -> «980», 120500 -> «121k». */
export function formatStars(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  const text = k < 100 ? k.toFixed(1).replace(/\.0$/, '') : String(Math.round(k))
  return `${text.replace('.', ',')}k`
}

/** «hace 2 días», «hace 3 meses». Sin librería: cuatro escalas bastan. */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return 'sin actividad conocida'
  const diff = Math.max(0, now - new Date(iso).getTime())
  const days = Math.floor(diff / 86_400_000)
  if (days < 1) return 'hoy'
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(days / 365)
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`
}

export const STATUS_LABELS: Record<UserRepository['personal']['status'], string> = {
  NEW: 'Nuevo',
  TO_REVIEW: 'Por revisar',
  REVIEWED: 'Revisado',
  TESTING: 'Probando',
  INSTALLED: 'Instalado',
  USING: 'En uso',
  FAVORITE: 'Favorito',
  REJECTED: 'Descartado',
  ARCHIVED: 'Archivado',
}

const ANALYSIS_LABELS = {
  PENDING: 'Resumen de IA en camino',
  COMPLETED: null,
  FAILED: 'La IA no pudo resumirlo',
  DISABLED: 'IA apagada',
} as const

/**
 * Tarjeta compacta (specs/library · «Tarjeta compacta»), en este orden:
 * nombre, resumen o descripción, `⭐ · licencia · lenguaje`, categorías,
 * última actividad y estado personal. El resumen de IA sustituye a la
 * descripción cuando existe; mientras no, la tarjeta lo dice.
 */
export function RepositoryCard({ item }: { item: UserRepository }) {
  const { repository: r, personal } = item
  const analysisNote = ANALYSIS_LABELS[r.analysis.status]
  return (
    <Card className="flex flex-col gap-2 p-4" data-testid="repository-card">
      <div className="flex items-start justify-between gap-2">
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium break-all hover:underline"
        >
          {r.owner} / {r.name}
        </a>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
          {STATUS_LABELS[personal.status]}
        </span>
      </div>
      <p className="text-sm text-muted">
        {r.analysis.summary ?? r.description ?? 'Sin descripción en GitHub'}
      </p>
      <p className="text-sm">
        <span aria-label={`${r.stars} estrellas`}>⭐ {formatStars(r.stars)}</span>
        {r.license ? <span> · {r.license}</span> : null}
        {r.primaryLanguage ? <span> · {r.primaryLanguage}</span> : null}
      </p>
      {r.topics.length ? (
        <ul className="flex flex-wrap gap-1" aria-label="Topics de GitHub">
          {r.topics.slice(0, 6).map((t) => (
            <li key={t} className="rounded bg-bg px-1.5 py-0.5 text-xs text-muted">
              {t}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted">
        Última actividad {relativeTime(r.githubPushedAt)}
        {analysisNote ? <span> · {analysisNote}</span> : null}
        {r.archived ? <span> · Archivado en GitHub</span> : null}
      </p>
    </Card>
  )
}
