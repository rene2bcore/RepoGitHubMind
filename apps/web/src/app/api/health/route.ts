export const dynamic = 'force-dynamic'

/**
 * GET /api/health · pública · el proceso responde. No toca la base a
 * propósito: es lo que miran el healthcheck del contenedor y Cloudflare, y
 * una base lenta no debe hacer que se reinicie la web. Fuera del contrato
 * `/api/v1`: no es API del producto.
 */
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
