import { expect, test } from '@playwright/test'

/**
 * El flujo principal, desde la primera pantalla y sin atajar por la API.
 * H1: registrarse, entrar directo a la biblioteca vacía, salir, y volver a
 * entrar. Crece con cada historia. Si esta prueba falla, el producto no se
 * puede demostrar.
 */
test('registrarse, ver la biblioteca vacía, salir y volver a entrar', async ({ page }) => {
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

  // 4. Recargar conserva la sesión.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tu biblioteca' })).toBeVisible()

  // 5. Salir invalida la sesión: la biblioteca vuelve a pedir acceso.
  await page.getByRole('button', { name: 'Salir' }).first().click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/library')
  await expect(page).toHaveURL(/\/login$/)

  // 6. Volver a entrar con la misma cuenta.
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
