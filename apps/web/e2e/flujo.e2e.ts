import { expect, test } from '@playwright/test'

/**
 * El flujo principal, desde la primera pantalla y sin atajar por la API.
 * H1: registrarse, entrar directo a la biblioteca vacía, salir, y volver a
 * entrar. H2: pegar una URL y ver el repositorio con su metadata. H3:
 * cambiar el estado desde la tarjeta, anotarlo en el detalle con el README
 * saneado, y que otra cuenta no vea nada de eso. H4: el resumen de IA llega
 * solo a la tarjeta, con su categoría y el riesgo etiquetado como valoración,
 * el detalle trae el análisis completo, y la categoría filtra desde la URL.
 * Crece con cada historia. Si esta prueba falla, el producto no se puede
 * demostrar. GitHub y la IA son los proveedores falsos (`GITHUB_FAKE=1`,
 * `AI_FAKE=1`), y el worker corre de verdad.
 */
test('registrarse, guardar un repositorio por URL, anotarlo, salir y volver a entrar', async ({
  page,
}) => {
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
  await expect(card).toContainText('⭐ 19.4k')
  await expect(card).toContainText('PostgreSQL')
  await expect(page.getByText('Todavía no has guardado ningún repositorio')).toHaveCount(0)

  // H4: sin recargar, el worker analiza y la tarjeta muestra el resumen, la
  // categoría del catálogo y el riesgo como valoración, sin porcentajes.
  await expect(card).toContainText('Resumen de prueba: Open-source vector similarity search', {
    timeout: 30_000,
  })
  await expect(card.getByRole('list', { name: 'Categorías' })).toContainText('Vector')
  await expect(card).toContainText('Valoración heurística: riesgo de abandono bajo')
  await expect(card).not.toContainText('%')

  // Volver a pegarla no duplica: se dice.
  await page.getByLabel('Pega una URL de GitHub').fill('github.com/pgvector/pgvector/')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('ya está en tu biblioteca')
  await expect(page.getByTestId('repository-card')).toHaveCount(1)

  // Una URL que no es de GitHub se rechaza junto al campo.
  await page.getByLabel('Pega una URL de GitHub').fill('https://gitlab.com/owner/repo')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('No es una URL de repositorio de GitHub')).toBeVisible()

  // 5. H3: el estado se cambia desde la tarjeta y se refleja al momento.
  await card.getByLabel('Estado').selectOption('USING')
  await expect(card.getByLabel('Estado')).toHaveValue('USING')
  await card.getByRole('button', { name: 'Marcar como favorito' }).click()
  await expect(card.getByRole('button', { name: 'Quitar de favoritos' })).toBeVisible()

  // El detalle: métricas, mis datos y el README saneado.
  await page.getByRole('link', { name: 'pgvector / pgvector' }).click()
  await expect(page).toHaveURL(/\/repositories\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: 'Mis datos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Casos de uso' })).toBeVisible()
  await expect(
    page.getByText('compartido por todas las cuentas que guardan este repositorio'),
  ).toBeVisible()
  await expect(page.getByText('Riesgo de abandono · Valoración heurística')).toBeVisible()
  await expect(page.getByTestId('readme')).toContainText('pgvector')
  // En móvil, la línea larga de un bloque de código del README no ensancha la
  // página: se desplaza dentro del bloque (H-10). Se compara con el viewport
  // del dispositivo y no con `innerWidth`, que en móvil crece con lo que
  // desborda y haría pasar la comprobación con el defecto puesto.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  )
  await page.getByLabel('Notas').fill('Probar el índice HNSW con embeddings')
  await page.getByRole('button', { name: '4 de 5' }).click()
  await page.getByRole('button', { name: 'Guardar mis datos' }).click()
  await expect(page.getByRole('status')).toContainText('Guardado')

  // Un README hostil: el script y el iframe no entran; el resto se ve.
  await page.goto('/library')
  await page.getByLabel('Pega una URL de GitHub').fill('https://github.com/antirez/kilo')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('link', { name: 'antirez / kilo' }).click()
  await expect(page.getByTestId('readme')).toContainText('Kilo is a small text editor')
  await expect(page.locator('[data-testid="readme"] iframe')).toHaveCount(0)
  await expect(page.locator('[data-testid="readme"] script')).toHaveCount(0)
  expect(
    await page.evaluate(() => (window as unknown as { hostil?: boolean }).hostil),
  ).toBeUndefined()

  // 5 bis. Recargar conserva la sesión y lo guardado, y el filtro viaja en la URL.
  await page.goto('/library?status=USING')
  await expect(page.getByRole('heading', { name: 'Tu biblioteca' })).toBeVisible()
  await expect(page.getByTestId('repository-card')).toHaveCount(1)
  await expect(page.getByTestId('repository-card').first()).toContainText('pgvector / pgvector')
  await expect(page.getByTestId('repository-card').first()).toContainText('★★★★')

  // La categoría filtra por su rama entera y viaja en la URL.
  await page.goto('/library?category=databases')
  await expect(page.getByLabel('Categoría', { exact: true })).toHaveValue('databases')
  await expect(page.getByTestId('repository-card')).toHaveCount(1)
  await expect(page.getByTestId('repository-card').first()).toContainText('pgvector / pgvector')
  // Una categoría que el catálogo no conoce se dice, y el resto de filtros se conserva.
  await page.goto('/library?status=USING&category=quantum-finance')
  // Por su texto: el anunciador de rutas de Next también es un `alert`.
  await expect(page.getByText('Orden o filtro no válido (category')).toBeVisible()
  await expect(page.getByTestId('repository-card')).toHaveCount(1)

  // 6. Salir invalida la sesión: la biblioteca vuelve a pedir acceso.
  await page.getByRole('button', { name: 'Salir' }).first().click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/library')
  await expect(page).toHaveURL(/\/login$/)

  // 7. Volver a entrar con la misma cuenta: todo sigue ahí.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secreto123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByTestId('repository-card')).toHaveCount(2)

  // 8. Otra cuenta guarda el mismo repositorio y no ve nada de lo mío.
  await page.getByRole('button', { name: 'Salir' }).first().click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/register')
  await page.getByLabel('Email').fill(`otra-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña', { exact: true }).fill('secreto123')
  await page.getByLabel('Repite la contraseña').fill('secreto123')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page).toHaveURL(/\/library$/)
  await page.getByLabel('Pega una URL de GitHub').fill('https://github.com/pgvector/pgvector')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const ajena = page.getByTestId('repository-card').first()
  await expect(ajena).toContainText('pgvector / pgvector')
  await expect(ajena.getByLabel('Estado')).toHaveValue('NEW')
  await expect(ajena).not.toContainText('★')
  await ajena.getByRole('link', { name: 'pgvector / pgvector' }).click()
  await expect(page.getByLabel('Notas')).toHaveValue('')
})

test('un fallo de acceso no revela si la cuenta existe', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(`nadie-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña', { exact: true }).fill('loquesea1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Email o contraseña incorrectos')).toBeVisible()
})
