import Link from 'next/link'
import type { AbandonmentRisk, AbandonmentRiskSource, Analysis, UserRepository } from '@rgm/shared'
import { AnalysisRetry } from '@/components/analysis-status'
import { Card } from '@/components/ui/card'
import { PersonalControls } from '@/components/personal-controls'

/** 19400 -> «19.4k», 980 -> «980», 120500 -> «121k». Es el formato de la spec. */
export function formatStars(n: number): string {
  if (n < 1000) return String(n)
  const k = n / 1000
  const text = k < 100 ? k.toFixed(1).replace(/\.0$/, '') : String(Math.round(k))
  return `${text}k`
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

export const ANALYSIS_LABELS = {
  PENDING: 'Resumen de IA en camino',
  COMPLETED: null,
  FAILED: 'Análisis no disponible',
  DISABLED: 'Análisis desactivado',
} as const

export const RISK_LABELS: Record<AbandonmentRisk, string> = {
  LOW: 'bajo',
  MEDIUM: 'medio',
  HIGH: 'alto',
  UNKNOWN: 'sin datos',
}

export const RISK_SOURCE_LABELS: Record<AbandonmentRiskSource, string> = {
  HEURISTIC: 'Valoración heurística',
  AI: 'Valoración de IA',
}

/**
 * «Valoración heurística: riesgo de abandono alto». Sin porcentajes ni
 * decimales, y siempre con de dónde sale (specs/ai · «Sin precisión falsa»).
 */
export function riskText(analysis: Pick<Analysis, 'abandonmentRisk' | 'abandonmentRiskSource'>) {
  return `${RISK_SOURCE_LABELS[analysis.abandonmentRiskSource]}: riesgo de abandono ${RISK_LABELS[analysis.abandonmentRisk]}`
}

/**
 * Tarjeta compacta (specs/library · «Tarjeta compacta»), en este orden:
 * nombre, resumen o descripción, `⭐ · licencia · lenguaje`, categorías,
 * última actividad y estado personal. El resumen de IA sustituye a la
 * descripción cuando existe; mientras no, la tarjeta lo dice, y si falló
 * ofrece reintentar. Madurez y riesgo de abandono van etiquetados como
 * valoración. El estado y el favorito se cambian desde aquí, sin abrir el
 * detalle.
 */
export function RepositoryCard({ item }: { item: UserRepository }) {
  const { repository: r, personal } = item
  const analysisNote = ANALYSIS_LABELS[r.analysis.status]
  const maturity = r.analysis.status === 'COMPLETED' ? r.analysis.maturity : null
  return (
    <Card className="flex flex-col gap-2 p-4" data-testid="repository-card">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/repositories/${item.id}`} className="font-medium break-all hover:underline">
          {r.owner} / {r.name}
        </Link>
        {personal.rating ? (
          <span
            className="shrink-0 text-xs text-muted"
            aria-label={`Rating ${personal.rating} de 5`}
          >
            {'★'.repeat(personal.rating)}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted">
        {r.analysis.summary ?? r.description ?? 'Sin descripción en GitHub'}
      </p>
      <p className="text-sm">
        <span aria-label={`${r.stars} estrellas`}>⭐ {formatStars(r.stars)}</span>
        {r.license ? <span> · {r.license}</span> : null}
        {r.primaryLanguage ? <span> · {r.primaryLanguage}</span> : null}
      </p>
      {r.categories.length ? (
        <ul className="flex flex-wrap gap-1" aria-label="Categorías">
          {r.categories.map((c) => (
            <li
              key={c.slug}
              title={c.path}
              className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
            >
              {c.name}
            </li>
          ))}
        </ul>
      ) : null}
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
        {r.analysis.status === 'FAILED' ? <AnalysisRetry id={item.id} /> : null}
        {r.archived ? <span> · Archivado en GitHub</span> : null}
      </p>
      <p className="text-xs text-muted">
        {maturity ? (
          <span>
            {RISK_SOURCE_LABELS.AI}: madurez {maturity}
            <br />
          </span>
        ) : null}
        {riskText(r.analysis)}
      </p>
      <PersonalControls id={item.id} personal={personal} />
    </Card>
  )
}
