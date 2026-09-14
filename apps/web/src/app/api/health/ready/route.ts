import { sql } from 'drizzle-orm'
import { getDb } from '@rgm/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health/ready · pública · la web llega a la base. Para el script de
 * despliegue: no se da por bueno un despliegue hasta que esto responde 200.
 * Un fallo responde 503 sin detalle (ADR-0004): el motivo va al log.
 */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    await getDb().execute(sql`select 1`)
    return Response.json({ status: 'ok', database: 'ok' }, { headers })
  } catch (error) {
    console.error('health/ready: la base no responde', error)
    return Response.json({ status: 'unavailable' }, { status: 503, headers })
  }
}
