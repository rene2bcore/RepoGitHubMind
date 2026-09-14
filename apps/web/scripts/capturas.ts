import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '@playwright/test'

/**
 * Capturas de pantalla para `docs/evidencia/` (sección 1.3 del readme de
 * LIDR). Recorre el flujo real contra un servidor ya levantado con la base
 * de pruebas, GitHub y la IA falsos y el worker en marcha, y guarda cada
 * pantalla a móvil y a escritorio.
 *
 * Uso, con las mismas variables en los dos procesos
 * (DATABASE_URL=<base de pruebas> GITHUB_FAKE=1 AI_ANALYSIS_ENABLED=true AI_FAKE=1):
 *   apps/web:    pnpm exec next dev -p 3002
 *   apps/worker: pnpm exec tsx src/index.ts
 *   apps/web:    pnpm exec tsx scripts/capturas.ts http://localhost:3002
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
  const foto = (fichero: string) =>
    // `caret: 'initial'`: ocultar el cursor inyecta un estilo en el campo de la
    // URL, React lo ve como un desajuste de hidratación y el aviso de Next
    // salía en todas las capturas.
    page.screenshot({
      path: join(out, `${fichero}-${nombre}.png`),
      fullPage: true,
      caret: 'initial',
    })

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
  // El worker analiza y la biblioteca se relee sola: se espera a que no quede
  // ningún resumen en camino.
  await page.waitForFunction(
    () => !document.body.innerText.includes('Resumen de IA en camino'),
    null,
    {
      timeout: 60_000,
    },
  )
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

  await page.goto(`${base}/library?category=artificial-intelligence`)
  await page.getByTestId('repository-card').first().waitFor()
  await foto('07-biblioteca-por-categoria')

  await page.goto(`${base}/library`)
  await page.getByRole('link', { name: 'pgvector / pgvector' }).click()
  await page.getByRole('heading', { name: 'Mis datos' }).waitFor()
  await page.getByLabel('Notas').fill('Probar el índice HNSW con los embeddings de H5')
  await page.getByRole('button', { name: '4 de 5' }).click()
  const guardado = page.waitForResponse((r) => r.url().includes('/personal') && r.ok())
  await page.getByRole('button', { name: 'Guardar mis datos' }).click()
  await guardado
  await foto('05-detalle')

  await page.goto(`${base}/login`)
  await foto('06-acceso')
  await ctx.close()
}

await browser.close()
console.log(`capturas en ${out}`)
