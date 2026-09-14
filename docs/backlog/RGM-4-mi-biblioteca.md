# RGM-4 · H3 · Mi biblioteca: estado, favorito, rating y notas privados

**Identificador:** `RGM-4` · [en Jira](https://ai4devs.atlassian.net/browse/RGM-4)
**Épica:** RGM-1
**Traza:** RF-10, RF-11, RF-12 del [PRD](../prd.md) · Prompt maestro §3, §4, §12, §14, §33, §35, §41
**Prioridad:** must-have · **Entrega:** 2 · **Spec:** [`specs/library`](../specs/library/spec.md)

## Historia

> Como persona con repositorios guardados, quiero ver mi biblioteca como lista o cuadrícula, cambiar el estado de cada repositorio, marcarlo favorito, puntuarlo y escribirle notas, para saber qué ya revisé, qué uso y qué descarté.

## Criterios de aceptación

### Camino feliz

**CA-1 · Tarjeta compacta**
DADO mi biblioteca
CUANDO la abro
ENTONCES cada repositorio es una tarjeta con nombre, descripción o resumen, `⭐ · licencia · lenguaje`, categorías, última actividad y mi estado.

**CA-2 · Cambiar el estado desde la tarjeta**
DADO un repositorio mío
CUANDO cambio su estado a uno de los nueve
ENTONCES se refleja al momento sin recargar, y si el servidor lo rechaza vuelve al estado real y avisa.

**CA-3 · Favorito, rating y notas**
DADO un repositorio mío
CUANDO lo marco favorito, le pongo un rating de 1 a 5 o una nota
ENTONCES se guarda y lo veo en la tarjeta y en el detalle.

**CA-4 · Orden y filtros**
DADO la lista
CUANDO ordeno por guardado, actualización, estrellas, nombre o rating, o filtro por estado, favorito, lenguaje, licencia o categoría
ENTONCES el orden y el filtro se aplican sin recargar y viajan en la URL.

### Lo que no debe ocurrir

**CA-5 · Lo mío no lo ve nadie**
DADO que otra cuenta tiene el mismo repositorio
CUANDO pide su biblioteca o el detalle
ENTONCES no ve mi estado, mi favorito, mi rating ni mis notas.

**CA-6 · Un id ajeno es un 404**
DADO el id de la relación de otra cuenta
CUANDO intento leerla o modificarla
ENTONCES recibo `404` igual que si no existiera, y nada cambia.

**CA-7 · Estado inventado**
DADO `{"status": "DONE"}`
CUANDO lo envío
ENTONCES recibo `422` sobre `status` y el estado no cambia.

### Errores y límites

**CA-8 · Biblioteca vacía**
DADO una cuenta nueva
CUANDO entra
ENTONCES ve qué es la biblioteca y el campo para pegar la primera URL, no una lista vacía sin más.

**CA-9 · README hostil** · **[PROPUESTO]**
DADO un README con `<script>` o `<iframe>`
CUANDO abro el detalle
ENTONCES no se ejecuta ni se incrusta nada y el resto del Markdown se ve.

_Motivo: el maestro §43 lo exige; el PRD lo tiene como no funcional sin historia. Se ancla aquí porque el detalle es de esta historia._

## Fuera de alcance

- Colecciones y tags personales, acciones offline (roadmap).

## Tickets

Construida el 2026-09-14 en `feat/RGM-4-mi-biblioteca`, en un solo PR sobre las tablas que H2 dejó.

**Backend.** `GET /api/v1/repositories/{id}` (detalle con README y lenguajes) y `PATCH /api/v1/repositories/{id}/personal` en `apps/web/src/app/api/v1/repositories/[id]/`; `getUserRepositoryDetail` y `updatePersonal` en `modules/repositories/service.ts`; `parseParams` en `lib/http.ts` (id mal formado es 404).

**Frontend.** Estado y favorito desde la tarjeta con vuelta atrás si el servidor rechaza (`components/personal-controls.tsx`); orden y filtros en la URL (`components/library-filters.tsx`); detalle en `app/(app)/repositories/[id]/page.tsx` con `components/personal-editor.tsx` y el README saneado (`components/readme.ts`, `react-markdown` con `skipHtml`).

**Definition of Done**

- [x] CA-1 a CA-8 con prueba de integración o de navegador; CA-9 validado contra el maestro §43 y probado (README hostil)
- [x] La frontera privado/público con dos cuentas: `apps/web/tests/library.test.ts` y el paso 8 de `flujo.e2e.ts`
- [x] Mutación `flujo-principal` en el catálogo, vista morder en la prueba con dos cuentas y en Playwright
- [x] `pnpm openapi:check` en verde con las dos rutas nuevas; tabla de `CLAUDE.md` al día
- [x] `docs/capabilities/library/README.md`; filas en `docs/traceability.md`
- [x] Dependencias nuevas comprobadas en npm y declaradas en el PR: `react-markdown` 10.1.0, `remark-gfm` 4.0.1
- [ ] `components/ui/` con `shadcn add` (H-04): sigue a mano; se cierra en la Entrega final
