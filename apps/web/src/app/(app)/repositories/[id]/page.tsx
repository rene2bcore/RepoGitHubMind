import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { NotFoundError, uuidParamSchema } from '@rgm/shared'
import { Card } from '@/components/ui/card'
import { PersonalEditor } from '@/components/personal-editor'
import { Readme } from '@/components/readme'
import { ANALYSIS_LABELS, formatStars, relativeTime } from '@/components/repository-card'
import { currentUser } from '@/lib/session'
import { getUserRepositoryDetail } from '@/modules/repositories/service'

export const dynamic = 'force-dynamic'

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })
    : '-'

/**
 * El detalle de **mi** relación con un repositorio (specs/library · «Detalle
 * de un repositorio»): cabecera, resumen de IA, métricas, actividad,
 * licencia, mis datos editables y el README saneado. Un id de otra cuenta es
 * la misma página de «no encontrado» que un id inexistente.
 */
export default async function RepositoryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/login')
  const parsed = uuidParamSchema.safeParse(await params)
  if (!parsed.success) notFound()

  let item
  try {
    item = await getUserRepositoryDetail(user.id, parsed.data.id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
  const { repository: r, personal } = item
  const analysisNote = ANALYSIS_LABELS[r.analysis.status]
  const languages = Object.entries(r.languages).sort((a, b) => b[1] - a[1])
  const totalBytes = languages.reduce((sum, [, bytes]) => sum + bytes, 0)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-4 text-sm">
        <Link href="/library" className="text-accent underline">
          ← Biblioteca
        </Link>
      </p>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold break-all">
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {r.owner} / {r.name}
          </a>
        </h1>
        {r.description ? <p className="mt-1 text-muted">{r.description}</p> : null}
        <p className="mt-2 text-sm">
          <span aria-label={`${r.stars} estrellas`}>⭐ {formatStars(r.stars)}</span>
          {r.license ? <span> · {r.license}</span> : null}
          {r.primaryLanguage ? <span> · {r.primaryLanguage}</span> : null}
          <span> · Última actividad {relativeTime(r.githubPushedAt)}</span>
          {r.archived ? <span> · Archivado en GitHub</span> : null}
        </p>
        {r.topics.length ? (
          <ul className="mt-2 flex flex-wrap gap-1" aria-label="Topics de GitHub">
            {r.topics.map((t) => (
              <li key={t} className="rounded bg-card px-1.5 py-0.5 text-xs text-muted">
                {t}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-4 md:col-span-2">
          <Card>
            <h2 className="mb-2 text-lg font-medium">Resumen</h2>
            {r.analysis.status === 'COMPLETED' ? (
              <div className="flex flex-col gap-2 text-sm">
                <p>{r.analysis.summary}</p>
                {r.analysis.purpose ? <p className="text-muted">{r.analysis.purpose}</p> : null}
                {r.analysis.mainUseCases.length ? (
                  <ul className="list-disc pl-5">
                    {r.analysis.mainUseCases.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                ) : null}
                {r.analysis.abandonmentRisk ? (
                  <p className="text-xs text-muted">
                    Riesgo de abandono según la actividad: {r.analysis.abandonmentRisk} (valoración
                    automática, no un hecho)
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">{analysisNote}</p>
            )}
          </Card>

          {r.readme ? (
            <Card>
              <h2 className="mb-2 text-lg font-medium">README</h2>
              <Readme markdown={r.readme} />
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-2 text-lg font-medium">Mis datos</h2>
            <PersonalEditor id={item.id} personal={personal} />
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-medium">Métricas y actividad</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Estrellas</dt>
              <dd>{r.stars.toLocaleString('es')}</dd>
              <dt className="text-muted">Forks</dt>
              <dd>{r.forks.toLocaleString('es')}</dd>
              <dt className="text-muted">Issues abiertas</dt>
              <dd>{r.openIssues.toLocaleString('es')}</dd>
              <dt className="text-muted">Licencia</dt>
              <dd>{r.license ?? 'No identificada'}</dd>
              <dt className="text-muted">Rama por defecto</dt>
              <dd>{r.defaultBranch ?? '-'}</dd>
              <dt className="text-muted">Última release</dt>
              <dd>
                {r.latestRelease ?? '-'}
                {r.latestReleaseAt ? ` · ${fecha(r.latestReleaseAt)}` : ''}
              </dd>
              <dt className="text-muted">Último push</dt>
              <dd>{fecha(r.githubPushedAt)}</dd>
              <dt className="text-muted">Creado en GitHub</dt>
              <dd>{fecha(r.githubCreatedAt)}</dd>
              <dt className="text-muted">Metadata leída</dt>
              <dd>{fecha(r.metadataRefreshedAt)}</dd>
              <dt className="text-muted">Guardado</dt>
              <dd>{fecha(personal.savedAt)}</dd>
            </dl>
            {languages.length ? (
              <ul className="mt-3 flex flex-col gap-1 text-xs" aria-label="Lenguajes">
                {languages.slice(0, 5).map(([name, bytes]) => (
                  <li key={name} className="flex justify-between">
                    <span>{name}</span>
                    <span className="text-muted">{Math.round((bytes / totalBytes) * 100)}%</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
    </main>
  )
}
