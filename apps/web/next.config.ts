import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Los paquetes del workspace se consumen como TypeScript sin compilar.
  transpilePackages: ['@rgm/shared', '@rgm/db'],
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
