import { describe, expect, it } from 'vitest'
import { abandonmentAssessment, heuristicAbandonmentRisk } from '../src/heuristics'

/**
 * specs/ai · «Riesgo de abandono como valoración»: `HIGH` si archivado o sin
 * push en 18 meses, `MEDIUM` sin push en 6 meses, `LOW` con push en 6 meses,
 * `UNKNOWN` sin datos; y «Repositorio archivado»: `HIGH` aunque la IA diga
 * otra cosa.
 */
const now = new Date('2026-09-14T12:00:00Z')
const at = (iso: string) => new Date(iso)

describe('heurística de abandono', () => {
  it('clasifica por la fecha del último push, con los límites de 6 y 18 meses', () => {
    const risk = (pushed: string | null, archived = false) =>
      heuristicAbandonmentRisk({ archived, githubPushedAt: pushed ? at(pushed) : null }, now)

    expect(risk('2026-09-13T00:00:00Z')).toBe('LOW')
    expect(risk('2026-03-14T12:00:00Z')).toBe('LOW') // exactamente 6 meses: aún con push en 6 meses
    expect(risk('2026-03-14T11:59:59Z')).toBe('MEDIUM')
    expect(risk('2025-03-14T12:00:00Z')).toBe('MEDIUM') // exactamente 18 meses
    expect(risk('2025-03-14T11:59:59Z')).toBe('HIGH')
    expect(risk('2020-03-01T00:00:00Z')).toBe('HIGH')
    expect(risk(null)).toBe('UNKNOWN')
  })

  it('archivado es HIGH aunque haya push ayer, y la valoración se etiqueta como heurística aunque la IA diga LOW', () => {
    const archivado = { archived: true, githubPushedAt: at('2026-09-13T00:00:00Z') }
    expect(heuristicAbandonmentRisk(archivado, now)).toBe('HIGH')
    expect(abandonmentAssessment(archivado, 'LOW', now)).toEqual({
      risk: 'HIGH',
      source: 'HEURISTIC',
    })
  })

  it('la IA solo cubre el hueco de UNKNOWN; sin datos de nadie, UNKNOWN heurístico', () => {
    const sinPush = { archived: false, githubPushedAt: null }
    expect(abandonmentAssessment(sinPush, 'MEDIUM', now)).toEqual({ risk: 'MEDIUM', source: 'AI' })
    expect(abandonmentAssessment(sinPush, null, now)).toEqual({
      risk: 'UNKNOWN',
      source: 'HEURISTIC',
    })
    expect(
      abandonmentAssessment(
        { archived: false, githubPushedAt: at('2026-09-01T00:00:00Z') },
        'HIGH',
        now,
      ),
    ).toEqual({ risk: 'LOW', source: 'HEURISTIC' })
  })
})
