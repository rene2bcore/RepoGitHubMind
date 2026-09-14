import { afterAll, describe, expect, it } from 'vitest'
import { closeDb } from '@rgm/db'
import { GET as health } from '@/app/api/health/route'
import { GET as ready } from '@/app/api/health/ready/route'

/**
 * RGM-12 · Lo que miran el healthcheck del contenedor y el script de
 * despliegue. `/api/health` no depende de la base; `/api/health/ready` sí.
 */
describe('health', () => {
  afterAll(() => closeDb())

  it('/api/health responde 200 sin tocar la base y sin caché', async () => {
    const res = health()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('/api/health/ready responde 200 cuando la base contesta', async () => {
    const res = await ready()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', database: 'ok' })
  })
})
