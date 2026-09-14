import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, databaseUrlForEnv, getDb, purgeExpiredSessions, sessions, users } from '../src'
import { truncateAllTables } from '../src/migrate'

/**
 * ADR-0013 · Las sesiones caducadas se borran; las vigentes no se tocan.
 */
describe('purgeExpiredSessions', () => {
  beforeAll(() => truncateAllTables(databaseUrlForEnv()))
  afterAll(() => closeDb())

  it('borra solo las caducadas y dice cuántas', async () => {
    const [user] = await getDb()
      .insert(users)
      .values({ email: `purga-${Date.now()}@example.com`, passwordHash: 'x' })
      .returning({ id: users.id })
    const ahora = Date.now()
    await getDb()
      .insert(sessions)
      .values([
        { token: 'caducada-1', userId: user!.id, expiresAt: new Date(ahora - 1000) },
        { token: 'caducada-2', userId: user!.id, expiresAt: new Date(ahora - 86_400_000) },
        { token: 'vigente', userId: user!.id, expiresAt: new Date(ahora + 86_400_000) },
      ])

    expect(await purgeExpiredSessions()).toBe(2)
    const quedan = await getDb().select({ token: sessions.token }).from(sessions)
    expect(quedan.map((s) => s.token)).toEqual(['vigente'])
    expect(await purgeExpiredSessions()).toBe(0)
  })
})
