import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Los paquetes del workspace se consumen como TypeScript sin compilar.
  transpilePackages: ['@rgm/shared', '@rgm/db', '@rgm/github'],
  // La imagen de producción (docker/Dockerfile.web) copia solo la salida
  // standalone. En un monorepo el trazado de dependencias parte de la raíz.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
  // Cabeceras de seguridad mínimas (prompt maestro §41). CSP llega con el
  // primer despliegue real, cuando se sepa qué orígenes hacen falta.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
