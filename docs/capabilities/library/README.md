# Capability: `library`

Mi biblioteca: lo que guardé, con mi estado, favorito, rating y notas, que solo yo veo. Lista con orden y filtros en la URL, tarjeta compacta con el estado cambiable, y un detalle con el README saneado.

> **Dónde está la verdad.** Las reglas viven en [`docs/specs/library/spec.md`](../../specs/library/spec.md) y este README no las repite: enlaza a cada una y dice dónde está implementada. Si algo de aquí y la spec no concuerdan, manda la spec.

## Route Handlers

Bajo `apps/web/src/app/api/v1/repositories/`, envueltos en `handle()`. Contrato en [`docs/api/openapi.json`](../../api/openapi.json). La lista (`GET /api/v1/repositories`) se documenta en [`capabilities/repositories`](../repositories/README.md); aquí, lo que es de cada persona.

| Método y ruta                              | Entrada                                                                                                         | Handler                  | Devuelve                                                               | Sesión |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------- | ------ |
| `GET /api/v1/repositories/{id}`            | `uuidParamSchema`                                                                                               | `[id]/route.ts`          | `200 { data: UserRepositoryDetail }` con `readme` y `languages`; `404` | sí     |
| `PATCH /api/v1/repositories/{id}/personal` | `personalUpdateSchema`: `status?`, `favorite?`, `rating?` (1..5 o null), `notes?` (≤ 4000 o null); al menos uno | `[id]/personal/route.ts` | `200 { data: UserRepository }` releída de la base; `422`; `404`        | sí     |

Un id de otra cuenta y un id inexistente responden el mismo `404`; un id mal formado también (`parseParams` en `src/lib/http.ts`). El cuerpo se valida **antes** de resolver el id: `{"rating": 6}` sobre un id que no existe es `422` ([ADR-0005](../../adr/0005-validar-antes-de-resolver.md)).

## Server Actions

Ninguna. Los cambios van por `api.updatePersonal` desde `components/personal-controls.tsx` (tarjeta y detalle) y `components/personal-editor.tsx` (detalle).

## Pantallas

| Ruta                 | Fichero                                | Qué hace                                                                                                                           |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/library`           | `app/(app)/library/page.tsx`           | Lee `?sort`, `?status`, `?favorite` con `libraryQuerySchema`; un valor fuera del dominio se dice y se lista por defecto            |
| `/repositories/{id}` | `app/(app)/repositories/[id]/page.tsx` | Cabecera, resumen de IA (o su estado), métricas y actividad, lenguajes, mis datos editables, README saneado. Otro id: `notFound()` |

## Reglas que no se ven en el contrato

| Regla                                                                                     | Requisito de la spec                                   | Dónde vive                                                                                        | Prueba                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toda consulta y modificación filtra por el `userId` de la sesión                          | Lo mío no lo ve nadie · La identidad sale de la sesión | `modules/repositories/service.ts` · `getUserRepository`, `updatePersonal`, `listUserRepositories` | `library.test.ts` · «la biblioteca de Grace no trae el estado ni la nota de Ada», «un userId en el cuerpo se ignora»; mutación `flujo-principal` |
| El id de otra cuenta es `404` indistinguible de uno inexistente                           | Id de otra cuenta                                      | `getUserRepositoryDetail`, `updatePersonal` (`NotFoundError`)                                     | `library.test.ts` · «el id de la relación de otra cuenta es 404...»                                                                              |
| Nueve estados fijos; otro valor es `422` sobre `status`                                   | Estado personal con nueve valores fijos                | `personalUpdateSchema` (`PERSONAL_STATUSES`)                                                      | `library.test.ts` · «un estado inventado es 422»                                                                                                 |
| Pasar a `REVIEWED` fija `reviewedAt`                                                      | Cambio de estado                                       | `updatePersonal`                                                                                  | `library.test.ts` · «cambiar a REVIEWED fija reviewedAt»                                                                                         |
| `favorite` es independiente del estado                                                    | Favorito y estado independientes                       | columna `favorite` aparte                                                                         | `library.test.ts` · «favorito y estado son independientes»                                                                                       |
| Rating 1..5 o null; notas ≤ 4000 o null; cuerpo vacío es `422`; validar antes de resolver | Rating y notas                                         | `personalUpdateSchema` + `parseBody` antes de `parseParams`                                       | `library.test.ts` · «un rating fuera de rango sobre un id que no existe es 422, no 404», «las notas se quitan con null...»                       |
| Filtros por estado y favorito con `meta.total`; orden fuera del dominio es `422`          | Lista con orden y filtros                              | `libraryQuerySchema`, `listUserRepositories`                                                      | `library.test.ts` · «filtra por estado y por favorito»; `repositories.test.ts` · `?sort=color`                                                   |
| La tarjeta refleja el cambio al momento y vuelve al valor real si el servidor lo rechaza  | Cambio desde la tarjeta                                | `components/personal-controls.tsx` (optimista con vuelta atrás)                                   | `flujo.e2e.ts` · cambiar el estado y marcar favorito desde la tarjeta                                                                            |
| El README se renderiza sin `script`, `iframe` ni HTML crudo                               | README hostil                                          | `components/readme.ts` (`react-markdown` con `skipHtml`)                                          | `readme.test.ts`; `flujo.e2e.ts` · el README hostil de `antirez/kilo` no incrusta nada                                                           |

Sin implementar: el filtro por categoría y por lenguaje o licencia en la interfaz (la API ya los acepta), las colecciones y tags personales (roadmap), y los similares (S2).

## Ejecutar y probar

```bash
docker compose -f docker/docker-compose.yml up -d postgres
pnpm test -- library          # integración con dos cuentas contra la base de pruebas
pnpm test -- readme           # el README hostil, sin navegador
pnpm test:e2e                 # el flujo entero, incluido el detalle y la segunda cuenta
node scripts/mutaciones.mjs flujo-principal
```
