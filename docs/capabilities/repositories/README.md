# Capability: `repositories`

Pegar la URL de un repositorio público de GitHub y verlo guardado con su metadata en segundos. El repositorio existe una vez para todas las cuentas; lo que cada persona anota es suyo.

> **Dónde está la verdad.** Las reglas viven en [`docs/specs/repositories/spec.md`](../../specs/repositories/spec.md) y este README no las repite: enlaza a cada una y dice dónde está implementada. Si algo de aquí y la spec no concuerdan, manda la spec.

## Route Handlers

En `apps/web/src/app/api/v1/repositories/route.ts`, envueltos en `handle()`. Contrato en [`docs/api/openapi.json`](../../api/openapi.json).

| Método y ruta               | Entrada                                                                                                                                                  | Handler | Devuelve                                                                                                                                               | Sesión |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `POST /api/v1/repositories` | `saveRepositorySchema`: `url`, `source?`                                                                                                                 | `POST`  | `201 { data: UserRepository }`; `200` si ya estaba; `404` GitHub no lo conoce; `422` URL; `429`                                                        | sí     |
| `GET /api/v1/repositories`  | `libraryQuerySchema`: `status`, `favorite`, `category`, `language`, `license`, `minStars`, `sort`, `page`, `pageSize`; cualquier otro parámetro es `422` | `GET`   | `200 { data: UserRepository[], meta: { total, page, pageSize } }`; `422` valor fuera del dominio, categoría fuera del catálogo o parámetro desconocido | sí     |

`UserRepository` es `{ id, repository, personal }` (`userRepositorySchema` en `packages/shared/src/schemas.ts`). `repository.analysis` y `repository.categories` son los de la capability [`ai`](../ai/README.md). Guardar pide el análisis solo si el repositorio no tiene uno vigente: la segunda cuenta lo recibe ya `COMPLETED`. El README no viaja en la lista: es del detalle (H3).

## Server Actions

Ninguna. La biblioteca (`components/library-view.tsx`) llama a `api.saveRepository` y lee la lista inicial desde el servidor con el mismo `listUserRepositories` que usa la ruta.

## Dónde vive cada cosa

| Pieza             | Fichero                                               | Qué hace                                                                                                                                           |
| ----------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normalizar la URL | `packages/shared/src/github-url.ts`                   | Cualquier variante a `owner/name` en minúsculas; todo lo que no sea `github.com` es `422` sobre `url`                                              |
| Hablar con GitHub | `packages/github/src/rest.ts` (`RestGitHubProvider`)  | REST API con `X-GitHub-Api-Version` y `Bearer` si hay `GITHUB_TOKEN`; 404 y límite a errores tipados; no vuelve a llamar hasta que pase la ventana |
| GitHub sin red    | `packages/github/src/fake.ts` (`FakeGitHubProvider`)  | Respuestas grabadas, un 404 y un 429; se elige con `GITHUB_FAKE=1` (pruebas y desarrollo sin token)                                                |
| Guardar y listar  | `apps/web/src/modules/repositories/service.ts`        | Busca por `fullName`, pide a GitHub solo si no existe, inserta por `github_repository_id`, crea la relación privada, encola el análisis            |
| Cola              | `packages/db/src/queue.ts`                            | `enqueueJob` idempotente, `claimJob` con `FOR UPDATE SKIP LOCKED`, `failJob` con backoff                                                           |
| Worker            | `apps/worker/src/jobs.ts`, `apps/worker/src/index.ts` | Consume la cola. `ANALYZE_REPOSITORY` está en `apps/worker/src/analyze.ts` (capability [`ai`](../ai/README.md))                                    |

## Reglas que no se ven en el contrato

| Regla                                                                                                               | Requisito de la spec                          | Dónde vive                                                      | Prueba                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Nunca se sigue la URL del usuario: solo `api.github.com` con `owner/name`                                           | Nunca se sigue una URL del usuario            | `parseGitHubUrl` + `RestGitHubProvider.fetchRepository`         | `rest.test.ts` · todas las llamadas van a `api.github.com`                                         |
| Un repositorio se pide a GitHub una vez, aunque lo guarden varias cuentas                                           | Segunda cuenta que guarda el mismo            | `saveRepository` · `findRepositoryId` antes de llamar a GitHub  | `repositories.test.ts` · «la segunda cuenta ... no vuelve a pedirlo»; mutación `repositorio-unico` |
| Volver a guardar lo que ya tengo es `200`, no duplica                                                               | Ya está en mi biblioteca                      | índice único `(user_id, repository_id)` + `onConflictDoNothing` | `repositories.test.ts` · «volver a guardar lo que ya tengo responde 200»                           |
| Las fechas van separadas; «Última actividad» es `githubPushedAt`                                                    | Última actividad                              | `GitHubRepositoryData` y `repository-card.tsx`                  | `rest.test.ts`, `repositories.test.ts` · fechas                                                    |
| Guardar responde sin esperar a la IA: `PENDING` y en cola si no hay análisis vigente; con la IA apagada, `DISABLED` | Guardar responde antes que la IA; La IA falla | `requestAnalysis` en el servicio, `apps/worker/src/analyze.ts`  | `repositories.test.ts` · PENDING/DISABLED; `cola.test.ts`; `analisis.test.ts`                      |
| El token de GitHub no llega al cliente                                                                              | El token nunca sale                           | Solo `RestGitHubProvider` lo lee del entorno                    | `repositories.test.ts` · la respuesta no contiene `ghp_` ni `Bearer`; `rest.test.ts`               |
| Límite de GitHub: `429` y no se insiste hasta que pase la ventana                                                   | Rate limit de GitHub                          | `RestGitHubProvider.blockedUntil`                               | `rest.test.ts` · 403 y 429 con cabeceras                                                           |
| Límite propio de guardados por cuenta                                                                               | PRD §7                                        | `checkRateLimit(\`save:${userId}\`)` en la ruta                 | sin prueba propia: misma función que auth, probada allí                                            |

Sin implementar, declarado en [`traceability.md`](../../traceability.md): importación masiva (S1, RGM-7).

## Ejecutar y probar

```bash
docker compose -f docker/docker-compose.yml up -d postgres
pnpm test -- repositories     # integración contra la base de pruebas, GitHub falso
pnpm test -- rest             # unitaria del proveedor real con fetch grabado
pnpm test -- cola             # la cola y el worker
pnpm test:e2e                 # el flujo entero desde la pantalla
node scripts/mutaciones.mjs repositorio-unico
```

En desarrollo, `GITHUB_FAKE=1` en `.env` evita la red; con `GITHUB_FAKE=0` y sin token, GitHub permite 60 peticiones por hora (cada guardado gasta 4).
