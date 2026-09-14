import { databaseUrlForEnv } from '@rgm/db'
import { truncateAllTables } from '@rgm/db/migrate'
import { POST as register } from '@/app/api/v1/auth/register/route'

/**
 * Ayudas para las pruebas de integración de los Route Handlers. Se llama al
 * handler directamente con un `Request`, sin servidor HTTP: es lo que Next
 * hace por dentro, y evita depender de un puerto.
 */
export function jsonRequest(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  }
  if (init.cookie) headers.cookie = init.cookie
  return new Request(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

/** La cookie de sesión tal como la enviaría el navegador después. */
export function cookieFrom(res: Response): string {
  const header = res.headers.get('set-cookie') ?? ''
  return header.split(';')[0] ?? ''
}

let contador = 0
export function emailUnico(prefijo = 'ada'): string {
  contador += 1
  return `${prefijo}-${Date.now()}-${contador}@example.com`
}

/** Una cuenta nueva con sesión abierta. */
export async function cuentaConSesion(
  prefijo = 'ada',
): Promise<{ email: string; cookie: string; id: string }> {
  const email = emailUnico(prefijo)
  const res = await register(
    jsonRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password: 'secreto123', passwordConfirmation: 'secreto123' },
    }),
    {},
  )
  if (res.status !== 201)
    throw new Error(`no se pudo crear la cuenta: ${res.status} ${await res.text()}`)
  const { data } = (await res.json()) as { data: { id: string } }
  return { email, cookie: cookieFrom(res), id: data.id }
}

/** Deja la base de pruebas vacía entre ficheros. */
export async function limpiarBase(): Promise<void> {
  await truncateAllTables(databaseUrlForEnv())
}
