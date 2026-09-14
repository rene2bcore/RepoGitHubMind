import type {
  ListMeta,
  LoginBody,
  RegisterBody,
  SaveRepositoryBody,
  User,
  UserRepository,
} from '@rgm/shared'

/**
 * Único punto de contacto del cliente con la API. Desenvuelve `{ data }`,
 * traduce `{ errors }` a `ApiError` con `fieldErrors` por campo, y avisa al
 * proveedor de sesión ante un 401 para que la interfaz vuelva al acceso.
 * Toda llamada nueva a la API se añade aquí, no en los componentes.
 */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, items: { message: string; field?: string }[]) {
    super(items[0]?.message ?? 'Error')
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = {}
    for (const item of items)
      if (item.field && item.field !== '_') this.fieldErrors[item.field] = item.message
  }
}

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

/** @returns una función para dejar de escuchar. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

type FetchLike = typeof fetch

export async function request<T>(
  path: string,
  init: RequestInit & { silenciarRechazo?: boolean } = {},
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const { body } = await requestFull<T>(path, init, fetchImpl)
  return body.data
}

/** Como `request`, pero con el estado y el `meta` de la respuesta. */
export async function requestFull<T>(
  path: string,
  init: RequestInit & { silenciarRechazo?: boolean } = {},
  fetchImpl: FetchLike = fetch,
): Promise<{ status: number; body: { data: T; meta?: ListMeta } }> {
  const { silenciarRechazo, ...rest } = init
  let res: Response
  try {
    res = await fetchImpl(path, {
      ...rest,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, [{ message: 'No se pudo conectar con el servidor' }])
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const items = isErrorBody(body) ? body.errors : [{ message: 'Error inesperado' }]
    if (res.status === 401 && !silenciarRechazo) for (const l of unauthorizedListeners) l()
    throw new ApiError(res.status, items)
  }
  return { status: res.status, body: body as { data: T; meta?: ListMeta } }
}

function isErrorBody(body: unknown): body is { errors: { message: string; field?: string }[] } {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { errors?: unknown }).errors)
  )
}

export const api = {
  register: (body: RegisterBody) =>
    request<User>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginBody) =>
    request<User>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ loggedOut: boolean }>('/api/v1/auth/logout', { method: 'POST' }),
  me: () => request<User>('/api/v1/auth/me', { silenciarRechazo: true }),
  /** 201 si es nuevo en la biblioteca, 200 si ya estaba: `created` lo dice. */
  saveRepository: async (body: SaveRepositoryBody) => {
    const { status, body: res } = await requestFull<UserRepository>('/api/v1/repositories', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return { item: res.data, created: status === 201 }
  },
  listRepositories: async (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    const { body } = await requestFull<UserRepository[]>(
      `/api/v1/repositories${qs ? `?${qs}` : ''}`,
    )
    return {
      items: body.data,
      meta: body.meta ?? { total: body.data.length, page: 1, pageSize: 24 },
    }
  },
}
