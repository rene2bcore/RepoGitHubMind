import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '@playwright/test'

/**
 * Capturas de pantalla para `docs/evidencia/` (sección 1.3 del readme de
 * LIDR). Recorre el flujo real contra un servidor ya levantado con la base
 * de pruebas y GitHub falso, y guarda cada pantalla a móvil y a escritorio.
 *
 * Uso, contra la imagen de producción (sin la insignia del servidor de
 * desarrollo), con la base de desarrollo migrada y GitHub falso:
 *   docker run --rm -d -p 3006:3000 -e DATABASE_URL=postgres://rgm:rgm@host.docker.internal:5434/repogithubmind  *     -e AUTH_SECRET=<32 caracteres> -e AUTH_URL=http://localhost:3006 -e GITHUB_FAKE=1 \
 *     -e AI_ANALYSIS_ENABLED=false repogithubmind-web
 *   pnpm exec tsx scripts/capturas.ts http://localhost:3006
 */
const base = process.argv[2] ?? 'http://localhost:3002'
const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'evidencia')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()

for (const [nombre, contexto] of [
  ['movil', { ...devices['Pixel 7'] }],
  ['escritorio', { viewport: { width: 1280, height: 800 } }],
] as const) {
  const ctx = await browser.newContext(contexto)
  const page = await ctx.newPage()
  const email = `capturas-${nombre}-${Date.now()}@example.com`
  // Se espera a que React termine de hidratar: capturar antes hace que
  // Playwright toque el DOM a mitad y el servidor de desarrollo lo marque
  // como error. Las capturas se hacen contra la imagen de producción.
  // En móvil se captura lo que cabe en la pantalla del teléfono: una captura
  // de página completa pinta la navegación inferior fija a mitad de la
  // imagen, encima de una tarjeta, y eso no lo ve nadie en un teléfono.
  const foto = async (fichero: string) => {
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: join(out, `${fichero}-${nombre}.png`),
      fullPage: nombre === 'escritorio',
    })
  }

  await page.goto(`${base}/register`)
  await foto('01-registro')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secreto123')
  await page.getByLabel('Repite la contraseña').fill('secreto123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByRole('heading', { name: 'Tu biblioteca' }).waitFor()
  await foto('02-biblioteca-vacia')

  for (const url of [
    'https://github.com/pgvector/pgvector',
    'https://github.com/langchain-ai/langgraph',
    'https://github.com/antirez/kilo',
  ]) {
    await page.getByLabel('Pega una URL de GitHub').fill(url)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('status').waitFor()
  }
  // Cada cambio se espera hasta que el servidor responda: navegar antes lo
  // cancelaría y la captura del filtro saldría vacía.
  const primera = page.getByTestId('repository-card').first()
  const estado = page.waitForResponse((r) => r.url().includes('/personal') && r.ok())
  await primera.getByLabel('Estado').selectOption('USING')
  await estado
  const favorito = page.waitForResponse((r) => r.url().includes('/personal') && r.ok())
  await primera.getByRole('button', { name: 'Marcar como favorito' }).click()
  await favorito
  await foto('03-biblioteca-con-repositorios')

  await page.goto(`${base}/library?status=USING`)
  await page.getByTestId('repository-card').first().waitFor()
  await foto('04-biblioteca-filtrada')

  await page.goto(`${base}/library`)
  await page.getByRole('link', { name: 'pgvector / pgvector' }).click()
  await page.getByRole('heading', { name: 'Mis datos' }).waitFor()
  await page.getByLabel('Notas').fill('Probar el índice HNSW con los embeddings de H5')
  await page.getByRole('button', { name: '4 de 5' }).click()
  const guardado = page.waitForResponse((r) => r.url().includes('/personal') && r.ok())
  await page.getByRole('button', { name: 'Guardar mis datos' }).click()
  await guardado
  await foto('05-detalle')

  // Con sesión, /login redirige a la biblioteca: se cierra la sesión por la
  // API con las cookies del propio navegador y se abre la pantalla de acceso.
  await page.request.post(`${base}/api/v1/auth/logout`)
  await page.goto(`${base}/login`)
  await foto('06-acceso')
  await ctx.close()
}

await browser.close()
console.log(`capturas en ${out}`)
