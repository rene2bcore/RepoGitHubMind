# Runbooks de RepoGitHubMind

> Qué hacer cuando algo se rompe, en el orden en que conviene hacerlo.
>
> Cada procedimiento sale de un incidente, y lo cita. Lo que no se ha ejecutado nunca va marcado como **no ejecutado nunca**: un runbook que finge producción donde no la hay es documentación desactualizada desde el primer día. A 2026-09-14 no hay código ([H-01](hallazgos.md)): lo que opera de verdad es CI, y es lo único descrito con procedimiento probado.
>
> Escrito el 2026-09-14.

## Índice

| Síntoma                                                | Sección                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| No arranca, puerto ocupado, la base no responde        | [1 · Entorno local](#1--entorno-local)                                     |
| Un job de «Verificación» en rojo                       | [2 · CI: Verificación](#2--ci-verificación)                                |
| El revisor adversarial en rojo, o en verde sin informe | [3 · CI: Revisión adversarial](#3--ci-revisión-adversarial)                |
| Hay que renovar la credencial del revisor              | [4 · Rotar la credencial del revisor](#4--rotar-la-credencial-del-revisor) |
| Un commit roto ya empujado, o rechazado por el hook    | [5 · Recuperación en git](#5--recuperación-en-git)                         |
| Hay que llevar una entrega al fork académico           | [6 · Entrega al fork](#6--entrega-al-fork)                                 |
| Se quiere desplegar                                    | [7 · Despliegue](#7--despliegue)                                           |
| Monitoreo e incidentes                                 | [8 · Monitoreo y guardia](#8--monitoreo-y-guardia)                         |

---

## 1 · Entorno local

**No ejecutado nunca**: no hay código. Lo que sigue es lo que el diseño exige.

### El backend no arranca: puerto 3000 ocupado

1. En Windows: `netstat -ano | findstr :3000`. En macOS o Linux: `lsof -i :3000`.
2. Si es un `next dev` o una ejecución de Playwright que quedó colgada, páralo.

### PostgreSQL no responde

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs postgres
docker compose -f docker/docker-compose.yml up -d postgres
```

### La base de desarrollo tiene datos basura

```bash
docker compose -f docker/docker-compose.yml down -v   # borra TODO, las dos bases
docker compose -f docker/docker-compose.yml up -d postgres
pnpm db:migrate && pnpm db:seed
```

### Las pruebas fallan de forma rara tras interrumpir una ejecución

La base de pruebas puede haber quedado con tablas a medias. `pnpm db:reset:test` (cuando exista) o borrar solo `repogithubmind_test` y volver a migrar.

### La web dice «No se pudo conectar»

1. ¿Está `postgres` arriba y `web` arrancado? `curl http://localhost:3000/api/health`.
2. ¿`AUTH_URL` en `.env` es `http://localhost:3000`? Tras cambiarla, reinicia: la app la lee al arrancar y decide con ella si la cookie lleva `Secure`.

---

## 2 · CI: Verificación

`verificacion.yml` corre en cada push a cualquier rama. Abre la ejecución y mira **qué job** falló; el color no dice por qué.

```bash
gh run list -R rene2bcore/RepoGitHubMind -b <rama> -L 5
gh run view <id> -R rene2bcore/RepoGitHubMind --log-failed
```

### Hay código que verificar

Hasta que exista `package.json`, los jobs `verificar` y `navegador` se omiten y el resumen lo dice. Es esperado ([H-01](hallazgos.md)). Si aparecen omitidos **después** de la Entrega 2, el job `codigo` no ve el `package.json`: mirar la ruta.

### Lint, tipos, formato, auditoría y pruebas

| Mensaje                                                       | Qué pasó                                                     | Qué hacer                                                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una prueba en rojo                                            | Lo que dice                                                  | Reproducir en local con `pnpm vitest run <fichero>`. Un bug no se cierra sin reproducirlo                                                                                                 |
| `recuento de pruebas: CLAUDE.md dice N y el runner ejecutó M` | Se añadió o quitó una prueba y `CLAUDE.md` no se actualizó   | Actualizar total **y desglose** en `CLAUDE.md`. Es el único sitio con el número                                                                                                           |
| Lint, tipos o formato                                         | Lo que dice                                                  | `pnpm lint`, `pnpm typecheck`, `pnpm format` en local y commitear                                                                                                                         |
| «Sin vulnerabilidades altas»                                  | `pnpm audit` encontró una alta o crítica                     | Primero relanzar: consulta el registro y puede fallar por red. Si se repite, `pnpm audit --fix` **sin** forzar; si solo se arregla con un salto de versión mayor, se decide y se registra |
| «El contrato versionado sigue al día»                         | Alguien tocó un Route Handler o un esquema Zod sin regenerar | `pnpm openapi:generate`, revisar el diff de `docs/api/openapi.json`, commitear. Si el diff no era esperado, el cambio de código es el problema                                            |

### Las comprobaciones muerden (R-14)

`scripts/mutaciones.mjs` reintroduce defectos que ya existieron y exige que cada comprobación se ponga en rojo **nombrando** el motivo.

| Salida                            | Qué significa                                                                       | Qué hacer                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ROJO sin mutar · <comprobación>` | Ya estaba roja antes de mutar nada                                                  | Arreglar eso primero: sin un verde de partida ningún rojo demuestra nada                                          |
| `NO APLICA <id>`                  | El código cambió y el texto que la mutación busca ya no aparece exactamente una vez | Actualizar la entrada del catálogo al código nuevo, **y comprobar que el arreglo sigue ahí**                      |
| `SOBREVIVE <comprobación>`        | Con el defecto puesto, sigue en verde                                               | Es un hallazgo: la comprobación ya no protege lo que dice. Registrarlo en `docs/hallazgos.md` antes de tocar nada |
| `ROJO POR OTRO MOTIVO`            | Falló, pero no por lo que la entrada dice                                           | Leer el volcado que sigue. Suele ser la marca de fallo del runner, distinta en Windows y Linux                    |

Para repetir una sola: `node scripts/mutaciones.mjs <id>`. Para ver el catálogo: `--listar`. El script restaura los ficheros al terminar, también con `Ctrl-C`.

### Imágenes de producción y stack arriba

Construye `docker/Dockerfile.web` y `docker/Dockerfile.worker`, levanta `docker/docker-compose.prod.yml` con un `docker/.env` generado al vuelo y exige `/api/health`, `/api/health/ready` y un registro `201`. Si falla, el paso «Registros si algo falla» vuelca los logs de todos los servicios.

| Síntoma                                  | Qué pasó                                                                   | Qué hacer                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| El build de `web` falla en `next build`  | Lo mismo que fallaría `pnpm --filter web build` en local                   | Reproducir en local con ese comando                                                                                                    |
| `migrate` sale distinto de cero          | Una migración no aplica sobre una base vacía                               | `docker compose -f docker/docker-compose.prod.yml logs migrate`; reproducir con `pnpm db:migrate:test` sobre la base de pruebas limpia |
| `--wait` agota el tiempo                 | Un healthcheck no pasa: la web no arranca o una variable obligatoria falta | Los logs de `web`: `Variables de entorno inválidas` dice cuál                                                                          |
| Un paquete del workspace no se encuentra | Se añadió un paquete y los Dockerfiles copian los `package.json` uno a uno | Añadir su `COPY packages/<nombre>/package.json` en los dos Dockerfiles                                                                 |

### La documentación corresponde con el código

| Paso                                   | Mensaje                                         | Qué hacer                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrastar documentación contra código | Líneas `FALLA  <comprobación> · <detalle>`      | Cada comprobación de `scripts/verificar-docs.mjs` explica en su comentario qué defecto previene. Arreglar el código o el documento, el que mienta                               |
| Placeholders sin rellenar              | `fichero:línea`                                 | Rellenar o borrar                                                                                                                                                               |
| El hook de rama / de mensaje           | `scripts/probar-hook-*.mjs`                     | Alguien cambió `.githooks/`. Ver sus casos en el script                                                                                                                         |
| Todo fix deja una prueba (R-08)        | `FALLA <sha> fix: ... · no toca ninguna prueba` | Si el arreglo tiene prueba, falta en el commit. Si no puede tenerla, el mensaje necesita `Sin-prueba: <motivo>`. Como el historial no se reescribe, se hace con un commit nuevo |

---

## 3 · CI: Revisión adversarial

`revision-adversarial.yml`. **No bloquea**: su trabajo es informar. Sus estados significan cosas distintas.

| Estado                     | Resumen del job                                        | Significado                                                               | Qué hacer                                                                                                   |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Verde                      | «sin credencial de Claude: se omite la revisión»       | No hay secreto configurado                                                | No debería pasar: el secreto está desde el 2026-09-14. Ver [sección 4](#4--rotar-la-credencial-del-revisor) |
| Verde                      | «la rama no tiene PR abierto»                          | La rama no es un cambio propuesto                                         | Nada. Abre el PR si quieres revisión                                                                        |
| Verde                      | El informe con Graves y Menores                        | Revisó                                                                    | **Leerlo.** Un grave se reproduce antes de arreglarlo                                                       |
| Rojo                       | «La revisión adversarial no pudo ejecutarse» con `401` | Credencial inválida o caducada                                            | [Sección 4](#4--rotar-la-credencial-del-revisor)                                                            |
| Rojo                       | `Reached max turns`                                    | El diff es demasiado grande para 40 turnos                                | Partir la unidad de trabajo. Por encima de ~6000 líneas el job ya avisa                                     |
| Rojo                       | Herramienta desconocida en `--disallowed-tools`        | La versión fijada del CLI (2.1.252) no conoce una herramienta de la lista | Comprobar la lista contra la versión instalada antes de subir el CLI                                        |
| Rojo por `timeout-minutes` | Cancelado                                              | Algo se colgó                                                             | Relanzar. Si se repite, leer el log del paso «Revisar»                                                      |

Para relanzarlo sin commit:

```bash
gh workflow run revision-adversarial.yml -R rene2bcore/RepoGitHubMind --ref <rama>
```

---

## 4 · Rotar la credencial del revisor

Hacerlo cuando el revisor sale en rojo con `401`, cuando se sospeche que el token se ha filtrado, o al cambiar de suscripción. **El token no pasa nunca por un chat, un issue ni un fichero del repositorio.**

1. Genera uno nuevo en local: `claude setup-token`. Empieza por `sk-ant-oat01-` y mide más de 100 caracteres.
2. Cópialo **entero**. La terminal lo parte en varias líneas y es fácil llevarse solo un trozo. En PowerShell, `(Get-Clipboard -Raw).Trim().Length` dice la longitud sin mostrarlo.
3. Guárdalo, pegándolo una sola vez cuando lo pida: `gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo rene2bcore/RepoGitHubMind`.
4. **Comprueba que se guardó**: `gh secret list --repo rene2bcore/RepoGitHubMind` debe fechar el secreto ahora. Un primer intento puede no cambiar la fecha y la ejecución siguiente usará el token viejo.
5. Relanza el revisor (sección 3) y comprueba que sale verde **con informe**, no con el aviso de «se omite».

`CLAUDE_CODE_OAUTH_TOKEN` gasta de la cuota de la suscripción. `ANTHROPIC_API_KEY` se factura aparte; no se cruzan.

---

## 5 · Recuperación en git

### Un commit empujado rompe algo

No se reescribe historial compartido. Se revierte con un commit nuevo: `git revert <sha>` y `git push`. Si el commit revertido era un `fix:`, el revert no es un `fix:` y no necesita prueba.

### El hook rechaza el commit: «no se commitea directo en main»

Los cambios no se pierden: `git switch -c feat/RGM-n-<slug>` se los lleva sin commitear. **No** uses `--no-verify`.

### El hook rechaza el mensaje

El asunto va como `feat: ...`, `fix(search): ...`, `docs: ...`. Los tipos admitidos los imprime el propio hook. R-08 lee ese prefijo para saber si un commit es un arreglo, así que no es estética.

### El hook no se ejecuta

`git config core.hooksPath .githooks`, o `pnpm install`, que lo hace desde el script `prepare`.

---

## 6 · Entrega al fork

Procedimiento de [ADR-0012](adr/0012-dos-repositorios-y-subtree.md). En el clon del fork, `C:\Users\renel\claudeWin_workspace\AI4Devs-finalproject`:

```bash
git switch feature/entrega-N-RLL            # o crearla desde main
git fetch producto
git subtree pull --prefix=producto producto main    # `add` solo la primera vez
ls                                          # esperado: readme.md prompts.md producto/
```

Después se rellenan `readme.md` y `prompts.md` de LIDR desde `producto/docs/` y `producto/prompts.md`, sin borrar encabezados ni notas, y se abre el PR hacia `LIDR-academy/AI4Devs-finalproject`. Si `subtree pull` da conflicto es porque alguien tocó `producto/` en el fork: no se toca; los cambios van al producto.

---

## 7 · Despliegue

Preparado en el código y probado en CI y en local; **no ejecutado todavía en el VPS** (RGM-14). Procedimiento, vuelta atrás y checklist en [`deployment-hostinger.md`](deployment-hostinger.md). Local y demo por túnel desde la máquina de desarrollo en [`deployment-local.md`](deployment-local.md).

---

## 8 · Monitoreo y guardia

**No hay.** No hay producción que vigilar, ni alertas, ni rotación de guardia. Lo que hace las veces de monitoreo hoy es CI en cada push, y quien la mira es quien empuja. Lo que ya existe para cuando se despliegue: `GET /api/health` sin tocar la base y `GET /api/health/ready` con ella; lo que falta (maestro §50): logs estructurados con id de petición; logs de trabajos del worker; `ai_usage` y errores de GitHub; una persona responsable y este documento como punto de partida.
