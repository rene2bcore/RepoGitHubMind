import { expect, test } from '@playwright/test'

/**
 * El flujo principal, desde la primera pantalla y sin atajar por la API.
 * H1: registrarse, entrar directo a la biblioteca vacía, salir, y volver a
 * entrar. H2: pegar una URL y ver el repositorio con su metadata. Crece con
 * cada historia. Si esta prueba falla, el producto no se puede demostrar.
 * GitHub es el proveedor falso (`GITHUB_FAKE=1` en `.env.test`).
 */
test('registrarse, guardar un repositorio por URL, salir y volver a entrar', async ({ page }) => {
  const email = `flujo-${Date.now()}@example.com`

  // 1. Sin sesión, la raíz y la biblioteca llevan al acceso.
  await page.goto('/library')
  await expect(page).toHaveURL(/\/login$/)

  // 2. Registro desde la pantalla, con el error junto al campo si algo falla.
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secreto123')
  await page.getByLabel('Repite la contraseña').fill('otra')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible()

  await page.getByLabel('Repite la contraseña').fill('secreto123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // 3. Entra directa a la biblioteca vacía, que explica qué es.
  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByRole('heading', { name: 'Tu biblioteca' })).toBeVisible()
  await expect(page.getByText('Todavía no has guardado ningún repositorio')).toBeVisible()

  // 4. H2: pega una URL y en segundos ve el repositorio con su metadata.
  await page.getByLabel('Pega una URL de GitHub').fill('https://github.com/PGvector/pgvector.git')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const card = page.getByTestId('repository-card').first()
  await expect(card).toContainText('pgvector / pgvector')
  await expect(card).toContainText('⭐ 19,4k')
  await expect(card).toContainText('PostgreSQL')
  await expect(page.getByText('Todavía no has guardado ningún repositorio')).toHaveCount(0)

  // Volver a pegarla no duplica: se dice.
  await page.getByLabel('Pega una URL de GitHub').fill('github.com/pgvector/pgvector/')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('ya está en tu biblioteca')
  await expect(page.getByTestId('repository-card')).toHaveCount(1)

  // Una URL que no es de GitHub se rechaza junto al campo.
  await page.getByLabel('Pega una URL de GitHub').fill('https://gitlab.com/owner/repo')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('No es una URL de repositorio de GitHub')).toBeVisible()

  // 5. Recargar conserva la sesión y lo guardado.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tu biblioteca' })).toBeVisible()
  await expect(page.getByTestId('repository-card')).toHaveCount(1)

  // 6. Salir invalida la sesión: la biblioteca vuelve a pedir acceso.
  await page.getByRole('button', { name: 'Salir' }).first().click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/library')
  await expect(page).toHaveURL(/\/login$/)

  // 7. Volver a entrar con la misma cuenta.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secreto123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/library$/)
})

test('un fallo de acceso no revela si la cuenta existe', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(`nadie-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña', { exact: true }).fill('loquesea1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Email o contraseña incorrectos')).toBeVisible()
})
