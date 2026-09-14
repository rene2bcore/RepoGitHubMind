import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const webSrc = fileURLToPath(new URL('./apps/web/src', import.meta.url))

/**
 * Un solo runner para el workspace entero. Dos proyectos:
 *
 * - `unit`: reglas puras de `packages/*` y de `apps/web/src`. Sin base ni red.
 * - `integration`: los Route Handlers y el cliente de la base contra
 *   PostgreSQL en Docker. `NODE_ENV=test` lo fija Vitest de forma
 *   incondicional, y con él `packages/db` elige `DATABASE_URL_TEST`
 *   (ADR-0003): la suite no puede escribir sobre la base de desarrollo.
 *
 * El número de pruebas vive en CLAUDE.md y CI lo contrasta con la última
 * línea «Tests» de esta salida.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@': webSrc } },
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'packages/*/tests/**/*.test.ts',
            'apps/*/src/**/*.test.ts',
            '!packages/db/tests/**',
          ],
        },
      },
      {
        resolve: { alias: { '@': webSrc } },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['packages/db/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
          setupFiles: ['./vitest.setup.integration.ts'],
          globalSetup: ['./vitest.global.integration.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
})
