# RGM-3 · H2 · Guardar un repositorio público por URL con su metadata de GitHub

**Identificador:** `RGM-3` · [en Jira](https://ai4devs.atlassian.net/browse/RGM-3)
**Épica:** RGM-1
**Traza:** RF-4 a RF-8 del [PRD](../prd.md) · Prompt maestro §5, §10, §13, §30, §68, §72
**Prioridad:** must-have · **Entrega:** 2 · **Spec:** [`specs/repositories`](../specs/repositories/spec.md)

## Historia

> Como persona que acaba de encontrar un repositorio, quiero pegar su URL y verlo guardado con nombre, descripción, estrellas, licencia, lenguaje y última actividad, para no perderlo y saber de un vistazo qué es.

## Criterios de aceptación

### Camino feliz

**CA-1 · Pegar y ver**
DADO mi biblioteca
CUANDO pego `https://github.com/pgvector/pgvector` y confirmo
ENTONCES en segundos veo el repositorio con estrellas, licencia, lenguaje principal, topics y última actividad, y la respuesta llega antes de que termine el análisis de IA.

**CA-2 · Cualquier variante de la URL**
DADO `github.com/PGvector/pgvector.git?x=1` o `github.com/pgvector/pgvector/`
CUANDO la pego
ENTONCES se normaliza a `pgvector/pgvector` y termina en el mismo repositorio.

**CA-3 · Un repositorio, una vez para todos**
DADO que otra cuenta ya guardó ese repositorio
CUANDO lo guardo yo
ENTONCES no se vuelve a pedir a GitHub y solo se crea mi relación privada.

### Lo que no debe ocurrir

**CA-4 · Ya está en tu biblioteca**
DADO que ya lo tengo
CUANDO lo vuelvo a pegar
ENTONCES se me dice «Ya está en tu biblioteca» y no se duplica.

**CA-5 · URL que no es de GitHub, o repositorio privado o inexistente**
DADO una URL de GitLab, una sin `owner/repo`, o un repositorio que GitHub no conoce
CUANDO la pego
ENTONCES recibo un error humano y no se crea nada.

**CA-6 · El token nunca sale**
DADO cualquier respuesta o página
CUANDO se inspecciona
ENTONCES el token de GitHub no aparece en ninguna parte del cliente.

### Errores y límites

**CA-7 · Rate limit de GitHub**
DADO que GitHub responde por límite de peticiones
CUANDO guardo
ENTONCES recibo un aviso para reintentar más tarde y el sistema no insiste hasta que pase la ventana.

**CA-8 · Las fechas, separadas** · **[PROPUESTO]**
DADO un repositorio guardado
CUANDO se muestra
ENTONCES «Última actividad» sale de `pushedAt`, y `createdAt`, `updatedAt`, `latestReleaseAt` y `metadataRefreshedAt` están disponibles por separado.

_Motivo: el maestro §13 lo exige; el PRD lo recoge como RF-8 pero sin decir cuál se muestra._

## Fuera de alcance

- Importación masiva (S1), refresh y Update All (roadmap), repositorios privados, GitLab.

## Tickets

Construida el 2026-09-14 en `feat/RGM-3-guardar-repositorio-por-url`, en las tres capas y en un solo PR (el ticket `RGM-3` no se descompuso en Jira: la historia cabía en un día).

**Datos.** `repositories`, `repository_analyses`, `user_repositories` y `background_jobs` en `packages/db/src/schema.ts`, migración `0001`. Cola con tabla propia ([ADR-0010](../adr/0010-cola-de-trabajos-en-postgresql.md), decidido).

**Backend.** `packages/github` con `GitHubProvider`, `RestGitHubProvider` y `FakeGitHubProvider`; `apps/web/src/modules/repositories/service.ts`; `POST` y `GET /api/v1/repositories`; `apps/worker` consumiendo la cola.

**Frontend.** La biblioteca con el campo «Pega una URL de GitHub» y las tarjetas (`components/library-view.tsx`, `components/repository-card.tsx`); `flujo.e2e.ts` guarda, repite y rechaza una URL de GitLab.

**Definition of Done**

- [x] CA-1 a CA-7 con prueba de integración o de navegador; CA-8 validado contra el maestro §13 y probado (fechas separadas)
- [x] `pnpm openapi:check` en verde con las dos rutas nuevas; tabla de `CLAUDE.md` al día
- [x] Mutación `repositorio-unico` en el catálogo, vista morder
- [x] `docs/capabilities/repositories/README.md`; filas en `docs/traceability.md`
- [x] Dependencias nuevas: ninguna (el proveedor usa `fetch` nativo)
