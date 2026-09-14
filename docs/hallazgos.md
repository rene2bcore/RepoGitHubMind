# Hallazgos técnicos

> Cosas descubiertas trabajando sobre el repositorio, no supuestos. Cada una indica **cómo se verificó**.
>
> No son decisiones de producto: esas viven en `prd.md`, sección 10, como `PA-n`. Aquí van los hallazgos técnicos y de proceso que van a doler si nadie los conoce de antemano.
>
> Este documento viaja con el proyecto, no con la rama. Al cambiar de rama base, se recorre entrada a entrada: un «Resuelto» sin rama no dice nada.

## Cómo se escribe una entrada

Cada entrada dice **qué rama describe** y **cómo se verificó**, y cuatro casillas que se responden con un hecho, **en blanco si no se puede confirmar leyendo el código o ejecutando algo**. No se rellenan por aproximación: el hueco es información.

| Casilla            | Qué se responde                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **Daño**           | Qué se rompe y quién lo nota. Un hecho, no un adjetivo                                             |
| **Radio**          | Cuántos sitios hay que tocar a la vez, **contados y listados** con `fichero:línea`. Nunca «varios» |
| **Reversibilidad** | Si el arreglo lo deshace un `revert` limpio, o deja rastro en datos ya guardados                   |
| **Precedencia**    | Si su arreglo abarata o encarece el de otro hallazgo, **cuál**                                     |

Y dos más que `scripts/verificar-docs.mjs` exige en cada entrada: **Reproducción**, un comando que lo provoque y que cualquiera pueda ejecutar, y **Qué lo vigila**, la comprobación que se pondría en rojo si volviera. Un hallazgo sin reproducción es una sospecha; uno sin vigilante vuelve solo.

La severidad no se escribe: es un criterio que quien escribe inventa. El orden en que se atacan lo da `.github/calibracion-revision.md`, «Criterio de priorización».

## Índice

| #    | Hallazgo                                                                               | Estado                                              |
| ---- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| H-01 | CI no puede ejecutar lint, tipos, pruebas ni contrato hasta que exista código          | Resuelto · `feat/RGM-2-cuentas-y-sesion` 2026-09-14 |
| H-02 | El hook de formato del harness rompía toda escritura al llegar con placeholders        | Resuelto · `main` 2026-09-14                        |
| H-03 | El merge de historias entre producto y fork pisaría `readme.md` en Windows             | Resuelto · ADR-0012, 2026-09-14                     |
| H-04 | Los componentes de `components/ui/` están escritos a mano, no traídos con `shadcn add` | Deuda aceptada, con fecha de cierre: H3 (RGM-4)     |
| H-05 | Los puertos 5432 y 5433 del host ya estaban ocupados por otros contenedores            | Resuelto · `feat/RGM-2-cuentas-y-sesion` 2026-09-14 |
| H-06 | Drizzle envuelve el error del driver y el código SQLSTATE no está en el nivel superior | Resuelto · `feat/RGM-2-cuentas-y-sesion` 2026-09-14 |

## Plantilla de entrada

```markdown
## H-nn · Título que dice qué pasa, no dónde

**Rama:** `[rama donde se observó]` · **Fecha:** AAAA-MM-DD · **Origen:** [revisión adversarial N / prueba X en rojo / lectura del código]

Qué pasa, en dos frases. Con el caso concreto: entrada o estado -> resultado.

**Cómo se verificó:** qué se ejecutó y qué salió.

**Reproducción:** `comando que lo provoca`

**Daño:** · **Radio:** N sitios: `fichero:línea`, `fichero:línea` · **Reversibilidad:** · **Precedencia:**

**Estado:** Abierto | Resuelto en `rama` el AAAA-MM-DD, commit `sha` | Deuda aceptada, con motivo

**Qué lo vigila:** `prueba` / comprobación de `verificar-docs.mjs` / entrada `id` de `mutaciones.mjs`
```

## H-01 · CI no puede ejecutar lint, tipos, pruebas ni contrato hasta que exista código

**Rama:** `main` · **Fecha:** 2026-09-14 · **Origen:** diseño de la Entrega 1

La Entrega 1 es documentación y el repositorio no tiene `package.json`. Los jobs `verificar` y `navegador` de `verificacion.yml`, y el paso de comparación del contrato, no tienen nada que ejecutar. Si corrieran, fallarían en rojo en cada push, y un rojo por algo que todavía no existe enseña a ignorar el rojo.

**Cómo se verificó:** `ls package.json` no existe; el job `codigo` de `verificacion.yml` lo detecta y los jobs dependientes se omiten con una línea en el resumen.

**Reproducción:** `test -f package.json; echo $?` devuelve 1.

**Daño:** hasta la Entrega 2, CI solo garantiza documentación, hooks y contrato; nada del código, porque no lo hay · **Radio:** 1 sitio: `.github/workflows/verificacion.yml:20` (job `codigo`) · **Reversibilidad:** sí, el gate desaparece solo al aparecer `package.json` · **Precedencia:** ninguna

**Estado:** Resuelto en `feat/RGM-2-cuentas-y-sesion` el 2026-09-14: RGM-9 creó el `package.json` raíz y desde ese push corren `verificar`, `navegador` y las mutaciones de producto.

**Qué lo vigila:** el resumen del job `codigo` diría «todavía no hay package.json» si desapareciera. `scripts/recuento-pruebas.mjs` exige que `CLAUDE.md` diga el número real de pruebas.

## H-02 · El hook de formato del harness rompía toda escritura al llegar con placeholders

**Rama:** `main` · **Fecha:** 2026-09-14 · **Origen:** primera escritura de `CLAUDE.md` tras copiar el harness

`.claude/settings.json` del harness lleva un hook `PostToolUse` que formatea con Prettier cada fichero que Claude edita, y el `case` de shell contenía la marca de placeholder del directorio del frontend sin rellenar. El corchete y los dos puntos rompen la sintaxis de `case`, y el hook fallaba con `syntax error near unexpected token` en **cada** escritura, incluida la que intentaba arreglarlo.

**Cómo se verificó:** el error salió en la primera `Write` de `CLAUDE.md`; se reescribió el hook desde Bash (sin pasar por el hook) y las escrituras siguientes no lo reprodujeron.

**Reproducción:** copiar `.claude/settings.json` del harness sin rellenar y editar cualquier fichero con Claude Code.

**Daño:** ninguna escritura del agente formateaba, y cada una imprimía un error que ocultaba otros · **Radio:** 1 sitio: `.claude/settings.json:11` · **Reversibilidad:** sí · **Precedencia:** abarata todo lo demás: sin esto ninguna edición era limpia

**Estado:** Resuelto en `main` el 2026-09-14: el hook formatea desde la raíz del monorepo solo si existe `node_modules/.bin/prettier`, y salta `core-harness/`. Registrado también en la bitácora del harness para que el próximo SETUP rellene ese fichero antes de la primera escritura.

**Qué lo vigila:** la comprobación «No queda ningún placeholder del harness sin rellenar» de `verificar-docs.mjs`, que incluye `.claude/settings.json`.

## H-03 · El merge de historias entre producto y fork pisaría `readme.md` en Windows

**Rama:** `main` · **Fecha:** 2026-09-14 · **Origen:** lectura de la plantilla de LIDR antes de decidir la sincronización

La plantilla de LIDR trae `readme.md` en minúsculas. El producto tiene `README.md`. En un sistema de ficheros que ignora mayúsculas, un merge que traiga `README.md` escribe sobre `readme.md`, y el fichero que LIDR evalúa desaparece sin conflicto ni aviso.

**Cómo se verificó:** en Git Bash, `mktemp -d`, `echo a > readme.md; echo b > README.md; ls; cat readme.md` lista un solo fichero e imprime `b`.

**Reproducción:** el comando anterior, en Windows o macOS con sistema de ficheros por defecto.

**Daño:** la Entrega 1 entregada sin el `readme.md` de LIDR, o con el del producto en su lugar · **Radio:** 1 decisión: la estrategia de sincronización · **Reversibilidad:** sí, antes de la primera entrega · **Precedencia:** ninguna

**Estado:** Resuelto el 2026-09-14 con [ADR-0012](adr/0012-dos-repositorios-y-subtree.md): el producto entra en el fork bajo `producto/` con `git subtree`, y la raíz del fork conserva solo los ficheros de LIDR.

**Qué lo vigila:** en el fork, `ls` de la raíz antes de cada PR de entrega: solo `readme.md`, `prompts.md` y `producto/`. Es una comprobación a mano; no hay CI en el fork.

## H-04 · Los componentes de `components/ui/` están escritos a mano, no traídos con `shadcn add`

**Rama:** `feat/RGM-2-cuentas-y-sesion` · **Fecha:** 2026-09-14 · **Origen:** implementación de RGM-11

La Definition of Done de RGM-11 pide `components/ui/` traídos con `shadcn add` y sin editar a mano. `shadcn init` sobre Next.js 16 con Tailwind 4 pide una configuración interactiva que no se ejecutó en la sesión, y para no bloquear la historia `button`, `input` y `card` se escribieron a mano con la misma API de props que shadcn genera. Son tres ficheros pequeños.

**Cómo se verificó:** `ls apps/web/src/components/ui` lista `button.tsx`, `input.tsx`, `card.tsx` y no hay `components.json` en `apps/web`.

**Reproducción:** `test -f apps/web/components.json; echo $?` devuelve 1.

**Daño:** el detalle del repositorio (H3) necesitará `badge`, `select`, `textarea` y `dialog`, y escribirlos a mano cuesta más que traerlos · **Radio:** 3 sitios: `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/card.tsx` · **Reversibilidad:** sí: `shadcn init` y `shadcn add` sustituyen los tres sin tocar a quien los usa · **Precedencia:** abarata H3

**Estado:** Deuda aceptada con fecha de cierre: RGM-4 (H3), que es la primera historia que necesita más componentes.

**Qué lo vigila:** la casilla de RGM-11 en `docs/backlog/RGM-2-cuentas-y-sesion.md`, que queda sin marcar hasta que exista `apps/web/components.json`.

## H-05 · Los puertos 5432 y 5433 del host ya estaban ocupados por otros contenedores

**Rama:** `feat/RGM-2-cuentas-y-sesion` · **Fecha:** 2026-09-14 · **Origen:** primer `docker compose up` de RGM-9

`docker compose up -d postgres` con `5432:5432` falló con `Bind for 0.0.0.0:5432 failed: port is already allocated`; 5433 también estaba en uso por otro contenedor de la máquina. El harness y el maestro daban por hecho el 5432.

**Cómo se verificó:** `docker ps --format '{{.Ports}}'` listó los dos puertos ocupados; con `5434:5432` el contenedor arrancó y `pg_isready` respondió.

**Reproducción:** en una máquina con otro PostgreSQL en 5432, `docker compose -f docker/docker-compose.yml up -d postgres` con el puerto por defecto.

**Daño:** ninguna prueba de integración arranca hasta que alguien cambie el puerto en cuatro sitios · **Radio:** 4 sitios: `docker/docker-compose.yml:16`, `.env.example:5`, `.env.test:4`, `.github/workflows/verificacion.yml:49` y `:106` (el servicio de CI publica el mismo puerto para que `.env.test` sirva sin cambios) · **Reversibilidad:** sí · **Precedencia:** ninguna

**Estado:** Resuelto en `feat/RGM-2-cuentas-y-sesion` el 2026-09-14: el compose publica 5434 y todas las URLs lo llevan.

**Qué lo vigila:** `packages/db/tests/aislamiento.test.ts` pregunta a la conexión viva por su base: si la URL no llega a un PostgreSQL, la suite entera está en rojo antes de la primera prueba.

## H-06 · Drizzle envuelve el error del driver y el código SQLSTATE no está en el nivel superior

**Rama:** `feat/RGM-2-cuentas-y-sesion` · **Fecha:** 2026-09-14 · **Origen:** prueba «la carrera de altas la para el índice único y responde 422, no 500» en rojo

`drizzle-orm` 0.45 lanza `DrizzleQueryError` con el `PostgresError` original en `cause`. El servicio de registro miraba `error.code === '23505'` en el nivel superior, nunca lo encontraba, y una alta repetida con otras mayúsculas respondía `500` en vez de `422` sobre el campo email.

**Cómo se verificó:** la prueba de integración salió en rojo con `expected 500 to be 422` y el log mostró `DrizzleQueryError ... cause: PostgresError: duplicate key value violates unique constraint "users_email_lower_unique"`. Con la detección recorriendo `cause`, verde.

**Reproducción:** `node scripts/mutaciones.mjs ADR-0005` reintroduce el defecto quitando la traducción.

**Daño:** un usuario que se registra dos veces ve «Error interno del servidor» en vez de «Ya existe una cuenta con ese email» · **Radio:** 1 sitio: `apps/web/src/modules/auth/service.ts:74` · **Reversibilidad:** sí · **Precedencia:** el mismo patrón vale para el índice único de `user_repositories` en H2

**Estado:** Resuelto en `feat/RGM-2-cuentas-y-sesion` el 2026-09-14: `isUniqueViolation` recorre `cause`.

**Qué lo vigila:** entrada `ADR-0005` de `mutaciones.mjs` y la prueba de la carrera de altas en `apps/web/tests/auth.test.ts`.

## Procedimiento al cambiar de rama base

Los arreglos viven en una rama, no en el producto. Al empezar sobre una rama nueva, **no cruzan solos**. En el proyecto de origen del harness volvieron rotos nueve, tres de ellos descubiertos solo al ejecutar las pruebas y no al leer.

1. Traer este fichero a la rama nueva: `git checkout <rama-anterior> -- docs/hallazgos.md`.
2. Ejecutar `node scripts/mutaciones.mjs`. Cada `NO APLICA` o `SOBREVIVE` es un arreglo que no cruzó. Se registra aquí antes de tocar nada.
3. Portar las pruebas y **ejecutarlas** con `echo $?`. Leer la rama no basta.
4. Lo que no está en el catálogo se comprueba a mano, entrada a entrada, contra el código de la rama nueva.
5. Comprobar lo que no es código de producto y por eso nadie mira: `.gitignore`, `.env.example` y `.env.test`, los `package.json`, `scripts/` y `.github/`.
6. **Portar, no pisar.** Si la rama nueva llegó a lo mismo por otro camino, se porta el arreglo sobre su versión.
