import { describe, expect, it } from 'vitest'
import { analysisExpiry, analysisStaleReason } from '../src/cache'

/**
 * specs/ai · «Un análisis por repositorio»: se reutiliza salvo que el
 * repositorio tenga pushes posteriores al análisis, que haya caducado, o que
 * se fuerce (ADR-0009, CA-2, CA-9).
 */
const now = new Date('2026-09-14T12:00:00Z')
const analizado = new Date('2026-09-10T00:00:00Z')
const vigente = {
  status: 'COMPLETED' as const,
  aiAnalyzedAt: analizado,
  expiresAt: analysisExpiry(analizado, 90),
}

describe('caché del análisis', () => {
  it('un análisis completado, vigente y posterior al último push se reutiliza', () => {
    expect(
      analysisStaleReason(vigente, { githubPushedAt: new Date('2026-09-09T00:00:00Z') }, { now }),
    ).toBeNull()
    expect(analysisStaleReason(vigente, { githubPushedAt: null }, { now })).toBeNull()
    expect(vigente.expiresAt.toISOString()).toBe('2026-12-09T00:00:00.000Z')
  })

  it('pushes posteriores, caducidad o forzado piden un análisis nuevo, cada uno con su motivo', () => {
    const repo = { githubPushedAt: new Date('2026-09-09T00:00:00Z') }
    expect(
      analysisStaleReason(vigente, { githubPushedAt: new Date('2026-09-12T00:00:00Z') }, { now }),
    ).toBe('changed')
    expect(
      analysisStaleReason({ ...vigente, expiresAt: new Date('2026-09-14T11:59:59Z') }, repo, {
        now,
      }),
    ).toBe('expired')
    expect(analysisStaleReason(vigente, repo, { now, force: true })).toBe('forced')
  })

  it('sin análisis, o con uno pendiente, fallido o desactivado, hay que analizar', () => {
    const repo = { githubPushedAt: null }
    expect(analysisStaleReason(null, repo, { now })).toBe('missing')
    for (const status of ['PENDING', 'FAILED', 'DISABLED'] as const) {
      expect(analysisStaleReason({ ...vigente, status }, repo, { now })).toBe('not-completed')
    }
  })
})
