# Capability: `auth`

Crear una cuenta con email y contraseña, entrar, salir, y que la sesión sobreviva a recargar. Es la puerta de la biblioteca: sin sesión no hay datos.

> **Dónde está la verdad.** Las reglas viven en [`docs/specs/auth/spec.md`](../../specs/auth/spec.md) y este README no las repite: enlaza a cada una y dice dónde está implementada. Si algo de aquí y la spec no concuerdan, manda la spec.

## Route Handlers

Todos bajo `apps/web/src/app/api/v1/auth/`, cada uno envuelto en `handle()` de `src/lib/http.ts` (manejador de errores único, [ADR-0004](../../adr/0004-el-volcado-de-depuracion-va-apagado.md)). Contrato en [`docs/api/openapi.json`](../../api/openapi.json).

| Método y ruta                | Entrada                                                       | Handler             | Devuelve                                                                              | Sesión       |
| ---------------------------- | ------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------- | ------------ |
| `POST /api/v1/auth/register` | `registerSchema`: `email`, `password`, `passwordConfirmation` | `register/route.ts` | `201 { data: User }` con `Set-Cookie: rgm_session`; `422`; `429`                      | no; la abre  |
| `POST /api/v1/auth/login`    | `loginSchema`: `email`, `password`                            | `login/route.ts`    | `200 { data: User }` con `Set-Cookie`; `401` idéntico en los dos fallos; `422`; `429` | no; la abre  |
| `POST /api/v1/auth/logout`   | ninguna                                                       | `logout/route.ts`   | `200 { data: { ok: true } }` y cookie vaciada                                         | sí; la borra |
| `GET /api/v1/auth/me`        | ninguna                                                       | `me/route.ts`       | `200 { data: User }`; `401` sin cuerpo de datos                                       | sí           |

`User` es `{ id, email, role, createdAt }`, definido en `packages/shared/src/schemas.ts` (`userSchema`) y compartido con el cliente.

## Server Actions

Ninguna. Las pantallas llaman a los Route Handlers a través de `src/lib/api.ts`, único punto de contacto del cliente con `/api/v1`.

## Pantallas

| Ruta        | Fichero                        | Qué hace                                                                            |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `/register` | `app/(auth)/register/page.tsx` | `AuthForm mode="register"`. Con sesión, redirige a `/library`                       |
| `/login`    | `app/(auth)/login/page.tsx`    | `AuthForm mode="login"`. Con sesión, redirige a `/library`                          |
| `/library`  | `app/(app)/library/page.tsx`   | Estado vacío de H1. El layout `app/(app)/layout.tsx` redirige a `/login` sin sesión |
| `/`         | `app/page.tsx`                 | Redirige a `/library` o a `/login` según haya sesión                                |

`AuthForm` (`src/components/auth-form.tsx`) valida con los mismos esquemas Zod que el servidor antes de enviar, muestra un error junto a cada campo y conserva lo escrito.

## Formas de respuesta

```json
{
  "data": {
    "id": "…",
    "email": "ada@example.com",
    "role": "USER",
    "createdAt": "2026-09-14T09:00:00.000Z"
  }
}
```

```json
{
  "errors": [
    { "field": "email", "rule": "unique", "message": "Ya existe una cuenta con ese email" }
  ]
}
```

Un `401` responde `{ "errors": [{ "message": "Email o contraseña incorrectos" }] }` en el acceso y `{ "errors": [{ "message": "Hace falta iniciar sesión" }] }` en las rutas protegidas. Un `429`, `{ "errors": [{ "message": "Demasiadas peticiones; inténtalo más tarde" }] }`.

## Reglas que no se ven en el contrato

| Regla                                                                      | Requisito de la spec                              | Dónde vive                                                                          | Prueba                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| El email se guarda en minúsculas y el índice único es sobre `lower(email)` | Un email, una sola cuenta, ignorando mayúsculas   | `registerSchema` (`toLowerCase`) y `packages/db/src/schema.ts`                      | `auth.test.ts` · alta repetida con otras mayúsculas; carrera de altas |
| La violación del índice único se traduce a `422` sobre `email`             | Carrera de altas                                  | `modules/auth/service.ts` · `isUniqueViolation` recorre `cause`                     | `auth.test.ts` · carrera 201/422/422; mutación `ADR-0005`             |
| Mismo `401`, y mismo coste, exista o no la cuenta                          | Un fallo no revela si la cuenta existe            | `modules/auth/service.ts` · `authenticate` compara contra `DUMMY_HASH`              | `auth.test.ts` · los dos cuerpos son idénticos                        |
| Token opaco en `sessions`; salir borra la fila                             | La sesión sobrevive a recargar y termina al salir | `src/lib/session.ts` ([ADR-0013](../../adr/0013-sesion-propia-en-vez-de-authjs.md)) | `auth.test.ts` · recargar y salir; `flujo.e2e.ts`                     |
| Cookie `HttpOnly; SameSite=Lax; Path=/`, `Secure` bajo HTTPS               | Protección de los recursos privados               | `serializeCookie` en `src/lib/session.ts`                                           | `auth.test.ts` · atributos de la cookie                               |
| `401` sin datos con cookie ausente, inventada o revocada                   | Sin sesión                                        | `getSessionUser(req)`                                                               | `auth.test.ts` · tres casos                                           |
| Un `userId` en el cuerpo no cambia nada                                    | Un userId en el cuerpo no cambia nada             | Los esquemas Zod no lo declaran y `getSessionUser` ignora el cuerpo                 | `auth.test.ts`                                                        |
| Límite de intentos por dirección en registro y acceso                      | Demasiados intentos                               | `src/lib/rate-limit.ts` · `checkRateLimit(clave)` en memoria                        | `auth.test.ts` · `429` al sexto intento con `x-forwarded-for`         |
| Un `500` responde el cuerpo cerrado                                        | ADR-0004                                          | `handle()` en `src/lib/http.ts`                                                     | `errores.test.ts`; mutación `ADR-0004`                                |

Sin prueba, declarado en [`traceability.md`](../../traceability.md): «El servidor no está disponible al arrancar» (CA-9 propuesto, pendiente de validar).

## Ejecutar y probar

```bash
docker compose -f docker/docker-compose.yml up -d postgres
pnpm test -- auth            # integración: apps/web/tests/auth.test.ts contra repogithubmind_test
pnpm test -- api             # unitaria: apps/web/src/lib/api.test.ts
pnpm test:e2e                # Playwright: apps/web/e2e/flujo.e2e.ts, escritorio y móvil
node scripts/mutaciones.mjs ADR-0004 ADR-0005
```

En desarrollo, `pnpm db:seed` crea `dev@repogithubmind.local` con la contraseña de ejemplo `desarrollo123`.
