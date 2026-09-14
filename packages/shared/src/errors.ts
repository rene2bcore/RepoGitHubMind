/**
 * Errores tipados del dominio (prompt maestro §81).
 *
 * Cada uno lleva el código HTTP con el que sale y la forma de error del
 * proyecto: `{ errors: [{ message, field?, rule? }] }`. `field` y `rule` solo
 * cuando el error viene de validar un campo; un 404 no los lleva porque no
 * viene de un campo, y ponerlos sería inventar una causa.
 *
 * Todo lo que no sea un AppError es un 500 y sale con la forma cerrada, sin
 * su mensaje (ADR-0004): el `message` de un error de base de datos es la
 * sentencia SQL entera.
 */
export type ErrorItem = { message: string; field?: string; rule?: string }

export class AppError extends Error {
  readonly status: number
  readonly items: ErrorItem[]

  constructor(status: number, items: ErrorItem[] | string) {
    const list = typeof items === 'string' ? [{ message: items }] : items
    super(list[0]?.message ?? 'error')
    this.name = new.target.name
    this.status = status
    this.items = list
  }

  toBody(): { errors: ErrorItem[] } {
    return { errors: this.items }
  }
}

/** 422: uno o varios campos no valen. Siempre con `field` y `rule`. */
export class ValidationError extends AppError {
  constructor(items: ErrorItem[]) {
    super(422, items)
  }
}

/** 401: sin sesión válida. Nunca dice por qué exactamente. */
export class AuthorizationError extends AppError {
  constructor(message = 'Hace falta iniciar sesión') {
    super(401, message)
  }
}

/** 404: no existe, o pertenece a otra cuenta. Las dos cosas responden igual. */
export class NotFoundError extends AppError {
  constructor(message = 'No encontrado') {
    super(404, message)
  }
}

export class RepositoryNotFoundError extends NotFoundError {
  constructor() {
    super('GitHub no conoce ese repositorio, o es privado')
  }
}

export class InvalidGitHubUrlError extends ValidationError {
  constructor() {
    super([{ field: 'url', rule: 'githubUrl', message: 'No es una URL de repositorio de GitHub' }])
  }
}

/** 429: nuestro límite o el de GitHub. */
export class RateLimitError extends AppError {
  constructor(message = 'Demasiadas peticiones; inténtalo más tarde') {
    super(429, message)
  }
}

export class GitHubRateLimitError extends RateLimitError {
  constructor() {
    super('GitHub ha limitado las peticiones; inténtalo más tarde')
  }
}

/** 502: el proveedor de IA falló. Guardar un repositorio nunca depende de esto. */
export class AIProviderError extends AppError {
  constructor(message = 'El proveedor de IA no respondió') {
    super(502, message)
  }
}

export const INTERNAL_ERROR_BODY = { errors: [{ message: 'Error interno del servidor' }] } as const
