import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '../../.env.test', override: true })

/**
 * Pruebas de navegador: lo que solo se observa en pantalla.
 *
 * La web y el worker arrancan con `DATABASE_URL` apuntando a la base de
 * **pruebas**, y el global setup la migra y la vacía antes (ADR-0003). Puerto
 * 3001 para no chocar con el servidor de desarrollo. GitHub y la IA son los
 * proveedores falsos: el resumen llega de verdad por la cola, sin red ni
 * clave. Sin reintentos: una prueba que solo pasa a la segunda es flaky, y un
 * reintento la esconde. No se lanza a la vez que `pnpm test`: comparten base
 * a propósito.
 */
const PORT = 3001
const BASE_URL = `http://localhost:${PORT}`
const env = {
  DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
  AUTH_URL: BASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET ?? 'solo-para-pruebas-no-es-un-secreto-real',
  GITHUB_FAKE: '1',
  AI_ANALYSIS_ENABLED: 'true',
  AI_FAKE: '1',
  DEBUG_HTTP_ERRORS: 'false',
  LOG_LEVEL: 'fatal',
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      name: 'web',
      command: `pnpm exec next dev -p ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env,
    },
    {
      name: 'worker',
      command: 'pnpm exec tsx src/index.ts',
      cwd: '../worker',
      wait: { stdout: /worker: escuchando la cola/ },
      reuseExistingServer: false,
      timeout: 60_000,
      env,
    },
  ],
})
