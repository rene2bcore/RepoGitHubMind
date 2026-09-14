# CLAUDE.md

Instrucciones para Claude Code (y para cualquier agente: `AGENTS.md` apunta aquí) al trabajar en este repositorio.

## Qué es este repo

RepoGitHubMind: las URLs de repositorios interesantes de GitHub acaban en chats y notas, y después no se recuerda qué era cada uno, para qué servía, si se revisó, qué licencia tenía ni si sigue activo. RepoGitHubMind es una biblioteca personal y buscable de repositorios públicos de GitHub: se pega una URL, se guarda con su metadata, la IA lo resume y clasifica, y se reencuentra con una búsqueda en lenguaje natural.

Producto open source de 2BCORE bajo Apache-2.0 (`LICENSE`, `NOTICE`), y a la vez Proyecto Final de AI4Devs (LIDR). **Este repositorio es la fuente de verdad**; el fork académico `rene2bcore/AI4Devs-finalproject` recibe cada entrega bajo `producto/` con `git subtree` ([ADR-0012](docs/adr/0012-dos-repositorios-y-subtree.md)). La especificación del producto es el prompt maestro, en [`docs/prompts/00-prompt-maestro.md`](docs/prompts/00-prompt-maestro.md); el alcance de la entrega académica, en [`docs/prd.md`](docs/prd.md).

El repositorio es también el registro de **cómo** se construye: PRD y specs, trazabilidad de historia a código, decisiones en ADR, y reglas de proceso bajadas a comprobaciones que corren en CI.

### Estructura

Monorepo con pnpm workspaces, decidido en [`docs/architecture.md`](docs/architecture.md). Existen `apps/web`, `apps/worker`, `packages/shared`, `packages/db`, `packages/github`, `packages/ai` (H4), `packages/search` (H5) y `packages/config`.

- `apps/web/` · Next.js (App Router) + React + TypeScript strict + Tailwind. UI, sesión propia con cookie `rgm_session` ([ADR-0013](docs/adr/0013-sesion-propia-en-vez-de-authjs.md)), Route Handlers bajo `/api/v1` y Server Actions. Puerto `3000`. Los `components/ui/` están escritos a mano hasta que entre shadcn ([H-04](docs/hallazgos.md))
- `apps/worker/` · Proceso Node que consume la cola de trabajos en PostgreSQL: fetch de GitHub, análisis IA, embeddings, refresh
- `packages/db/` · Esquema Drizzle, migraciones y seeds. `packages/github/` · `GitHubProvider` sobre la REST API. `packages/ai/` · `AIProvider` y `AIProviderRegistry`. `packages/search/` · búsqueda híbrida. `packages/shared/` · tipos, errores tipados, esquemas Zod. `packages/config/` · eslint, prettier, tsconfig compartidos
- `docker/` · `docker-compose.yml` de desarrollo (solo `postgres` con las dos bases); `docker-compose.prod.yml`, `Dockerfile.web` y `Dockerfile.worker` para el VPS ([`docs/deployment-hostinger.md`](docs/deployment-hostinger.md))
- `docs/` · producto, arquitectura, specs, trazabilidad, decisiones, runbooks, hallazgos
- `scripts/` · lo que CI ejecuta y también sirve en local

Las ramas de entrega del fork llevan las iniciales que LIDR exige: `feature/entrega-1-RLL`, `feature/entrega-2-RLL`, `final-project-RLL`. Aquí `main` es la base y **no se commitea en ella**.

## Comandos

Todos desde la raíz del monorepo. PostgreSQL se publica en el puerto **5434** del host (`docker/docker-compose.yml`), porque 5432 y 5433 suelen estar ocupados por otros contenedores ([H-05](docs/hallazgos.md)); las URLs de `.env.example` y `.env.test` ya lo llevan.

```bash
pnpm install --frozen-lockfile
docker compose -f docker/docker-compose.yml up -d postgres   # PostgreSQL 16 con pgvector, en localhost:5434, con las dos bases
cp .env.example .env
pnpm db:migrate                 # migraciones de Drizzle
pnpm db:seed                    # taxonomía (en todos los entornos) y usuario de desarrollo
pnpm dev                        # web en :3000 y worker a la vez; pnpm dev:web o dev:worker por separado
pnpm test                       # Vitest en todo el workspace
pnpm test:e2e                   # Playwright, en apps/web; la primera vez: pnpm --filter web exec playwright install chromium
pnpm lint                       # eslint
pnpm typecheck                  # tsc --noEmit en cada paquete
pnpm format                     # prettier --write
pnpm format:check               # lo que corre CI: sale 1 si algo no está formateado
pnpm audit --audit-level=high   # lo que corre CI
pnpm openapi:generate           # escribe docs/api/openapi.json desde los esquemas Zod de los Route Handlers
pnpm openapi:check              # sale 1 si el fichero ya no es el contrato generado. No arregla nada
pnpm --filter web build         # build de producción (standalone), el que usa docker/Dockerfile.web
```

El stack de producción en local, igual que en el VPS y en el job `imagenes` de CI:

```bash
cp docker/.env.example docker/.env   # POSTGRES_PASSWORD, AUTH_SECRET, AUTH_URL=http://localhost:3000, TRUST_PROXY=false
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env up -d --build --wait postgres web worker
curl -fsS http://localhost:3000/api/health/ready
```

Hoy hay **145 pruebas** en el monorepo: 58 en web, 17 en worker y 70 en packages. **Este es el único sitio que da el número**, y CI lo contrasta con lo que ejecuta Vitest (`scripts/recuento-pruebas.mjs`): al añadir una prueba, se actualiza aquí, total y desglose.

Las pruebas de navegador (Playwright, `apps/web/e2e/*.e2e.ts`) levantan `web` en el puerto 3001 contra la base de pruebas, nunca la de desarrollo, y la vacían al arrancar. Cubren pocos casos a propósito: el flujo principal entero desde la pantalla de registro y lo que ninguna otra capa ve.

Desde la raíz, sin dependencias instaladas:

```bash
node scripts/verificar-docs.mjs      # la documentación corresponde con el código
node scripts/mutaciones.mjs          # cada comprobación se pone en rojo con el defecto que dice cubrir
node scripts/mutaciones.mjs --listar
```

## Arquitectura

Monolito modular en Next.js con un worker aparte y PostgreSQL + pgvector como única infraestructura de datos ([ADR-0006](docs/adr/0006-monolito-modular.md), [ADR-0007](docs/adr/0007-postgresql-y-pgvector.md)). Contexto, contenedores y componentes en [`docs/architecture.md`](docs/architecture.md). Modelo de datos en [`docs/data-model.md`](docs/data-model.md). Lo que el sistema debe hacer, en [`docs/specs/`](docs/specs/). El contrato de la API, en [`docs/api/openapi.json`](docs/api/openapi.json).

### Rutas

Route Handlers bajo `/api/v1`. `scripts/verificar-docs.mjs` contrasta esta tabla contra el contrato: una ruta aquí que no esté en `openapi.json`, o al revés, pone CI en rojo. Toda ruta nueva entra aquí y en el contrato en el mismo commit que su código. Las Server Actions no van al contrato: se documentan en `docs/capabilities/`.

| Método | Ruta                                | Auth |
| ------ | ----------------------------------- | ---- |
| POST   | `/api/v1/auth/register`             | no   |
| POST   | `/api/v1/auth/login`                | no   |
| POST   | `/api/v1/auth/logout`               | sí   |
| GET    | `/api/v1/auth/me`                   | sí   |
| POST   | `/api/v1/repositories`              | sí   |
| GET    | `/api/v1/repositories`              | sí   |
| GET    | `/api/v1/repositories/:id`          | sí   |
| PATCH  | `/api/v1/repositories/:id/personal` | sí   |
| POST   | `/api/v1/repositories/:id/analysis` | sí   |
| GET    | `/api/v1/search`                    | sí   |

### El modelo conceptual que no se negocia

- **`Repository` es global y `UserRepository` es privada** ([ADR-0008](docs/adr/0008-repository-global-y-userrepository-privada.md)). Un repositorio existe una vez aunque lo guarden mil usuarios. Notas, estado, rating, tags y colecciones de una persona **nunca** salen a otra. Toda query sobre `UserRepository` filtra por el usuario de la sesión, nunca por un `userId` que venga del cliente.
- **La IA opera sobre `Repository` y se cachea** ([ADR-0009](docs/adr/0009-proveedor-de-ia-reemplazable.md)): un análisis por repositorio, reutilizado por todos los usuarios, salvo que el repositorio cambie, el análisis caduque o se fuerce. El proveedor se elige por variables `AI_*` y nunca se hardcodea un modelo.
- **Las URLs se normalizan y el identificador estable es el id de GitHub**: `github.com/owner/repo`, con `/`, con `.git` o con query, terminan en la misma `Repository`.
- **Los trabajos son idempotentes y viven en PostgreSQL** ([ADR-0010](docs/adr/0010-cola-de-trabajos-en-postgresql.md)): tabla propia `background_jobs` tomada con `FOR UPDATE SKIP LOCKED` (`packages/db/src/queue.ts`); sin Redis, sin microservicios.
- **GitHub se llama solo con `owner/name` normalizado y a través de `GitHubProvider`** (`packages/github`); con `GITHUB_FAKE=1` no hay red. El token no sale del servidor.
- **La IA se llama solo a través de `AIProvider`** (`packages/ai`), elegido por `AIProviderRegistry.fromEnv`; con `AI_FAKE=1` no hay red ni clave. El único nombre de modelo del código es el valor por defecto de `packages/ai/src/defaults.ts`. La regla de la caché (`analysisStaleReason`) la preguntan la web al encolar y el worker antes de llamar.
- **La búsqueda es híbrida y no mezcla cuentas** (`packages/search`): `search_vector` y `repository_embeddings` salen solo del repositorio global y su análisis, nunca de `user_repositories`; en los dos ámbitos, `personal` es la relación de la cuenta de la sesión o null. Sin embedding de la consulta, la búsqueda sigue en modo léxico.

### Decisiones que el código no explica solo

- **El contrato se genera desde Zod, se versiona y se vigila la deriva** ([ADR-0001](docs/adr/0001-el-contrato-se-genera-se-versiona-y-se-vigila-la-deriva.md)).
- **La documentación se verifica, no se regenera** ([ADR-0002](docs/adr/0002-la-documentacion-se-verifica-no-se-regenera.md)).
- **Las pruebas no pueden escribir en la base de desarrollo** ([ADR-0003](docs/adr/0003-aislamiento-de-la-base-de-datos-en-pruebas.md)): `DATABASE_URL` de pruebas apunta a otra base del mismo PostgreSQL y el runner la fuerza.
- **El volcado de depuración va apagado en todos los entornos** ([ADR-0004](docs/adr/0004-el-volcado-de-depuracion-va-apagado.md)): ningún error devuelve traza, SQL ni rutas del disco. Un 5xx responde `{ "errors": [{ "message": "Error interno del servidor" }] }`.
- **Se valida la petición antes de resolver el identificador** ([ADR-0005](docs/adr/0005-validar-antes-de-resolver.md)): `422` antes que `404`.
- **Apache-2.0 con copyright de 2BCORE** ([ADR-0011](docs/adr/0011-licencia-apache-2.md)).
- **La sesión es propia mientras solo haya credenciales**: token opaco en `sessions`, cookie `rgm_session` HttpOnly, `getSessionUser(req)` como única fuente de identidad; Auth.js vuelve con OAuth en R2 ([ADR-0013](docs/adr/0013-sesion-propia-en-vez-de-authjs.md)).

## Seguridad que se comprueba

Del §41 del prompt maestro, lo que tiene prueba o comprobación: cookie de sesión `HttpOnly`, `SameSite=Lax` y `Secure` bajo HTTPS, con mutaciones solo por JSON ([ADR-0013](docs/adr/0013-sesion-propia-en-vez-de-authjs.md)); autorización siempre en el servidor desde la sesión; validación con Zod en formularios, Route Handlers, salidas de IA y variables de entorno; rate limiting en las rutas que llaman a GitHub y a la IA; el README de GitHub se renderiza como Markdown saneado, sin `script`, `iframe` ni HTML crudo; los `.txt` de importación se validan por tamaño y MIME y no se conservan; los tokens de GitHub y de IA viven solo en el servidor. Cada uno con su fila en `docs/traceability.md` cuando exista la prueba.

## Documentación de código

TSDoc va donde el lector no puede deducirlo del código, y en ningún otro sitio: lo exportado que otros paquetes consumen (`GitHubProvider`, `AIProvider`, los errores tipados, los esquemas Zod compartidos), una regla de negocio o una decisión que no se ve en la línea, y nada en lo trivial ni en lo generado (esquema Drizzle generado, `components/ui/`). Un comentario que afirma algo que el código no hace es un defecto grave para el revisor (`REVIEW.md`): al cambiar el comportamiento se cambia el comentario en el mismo commit. `any` solo con justificación escrita al lado.

## Reglas de proceso

> Cada regla lleva su **modo de fallo**, porque es lo que decide dónde tiene que vivir.
> Lo que falla ruidoso puede quedarse escrito aquí: se nota solo. Lo que falla en silencio hay que bajarlo a algo que lo ejecute, o se cumplirá lo justo para que dejes de comprobarlo. Y lo que no se puede comprobar se dice, en vez de fingir que se cumple.
>
> **El modo de fallo es una propiedad de la regla y se declara aquí. Si la regla se cumple o no es empírico, y va en [`docs/auditoria-reglas-de-proceso.md`](docs/auditoria-reglas-de-proceso.md).**

### Ciclo de trabajo

- **La rama es por unidad de trabajo, no por petición** (R-01). · _Silencioso._
  Antes de tocar código, mira en qué rama estás: si ya es una rama de trabajo, sigue en ella. Solo desde `main` se crea una nueva (`git switch -c feat/RGM-n-<slug>`). Nunca commitear directo en `main`: **lo impide `.githooks/pre-commit`**, activado con `git config core.hooksPath .githooks` o por el script `prepare` al instalar. Lo prueba `scripts/probar-hook-rama.mjs` en CI.
- **El commit es por petición** (R-02). · _Ruidoso._
  Al cerrar cada una, la skill `/commit`. Asunto convencional, `tipo(ámbito): qué`: lo exige `.githooks/commit-msg` y lo prueba `scripts/probar-hook-mensaje.mjs`.
- **Un cambio que toque Route Handlers, esquemas Zod o serializadores cierra en el mismo commit con el contrato al día** (R-05). · _Silencioso._
  `pnpm openapi:generate`, y CI pone la build en rojo si se olvida. También el README de la capability en `docs/capabilities/<nombre>/README.md`.
- **`gh pr create` y el revisor adversarial van una sola vez, al terminar la unidad de trabajo** (R-03). · _Silencioso._
  El PR lleva la plantilla entera, incluida «Lo que este PR NO arregla», y la clave `RGM-n`. El revisor corre solo en CI sobre cada push de una rama con PR abierto; su informe queda en el PR.
- **Se verifica por código de salida, nunca por la última línea impresa** (R-06). · _Silencioso._
  `pnpm test; echo $?`, no `pnpm test | tail -1`. **En los workflows lo comprueba el verificador**: todo `run:` con tubería declara `set -o pipefail`.
- **Al cambiar de rama base, los hallazgos cruzan y se comprueban uno a uno** (R-07). · _Silencioso._
  `docs/hallazgos.md` viaja con el proyecto. Lo primero en la rama nueva es `node scripts/mutaciones.mjs`: cada `NO APLICA` o `SOBREVIVE` es un arreglo que no cruzó. Procedimiento al final de `docs/hallazgos.md`.
- **Cada historia empieza en Jira y termina en Jira** (R-15). · _Silencioso._
  La skill `/priority-ticket` trae el ticket `RGM-n` de mayor prioridad en «Por hacer», lo mueve a «En curso» al aprobar el plan y a «En revisión» al abrir el PR, con el enlace. Manda el repositorio: si el tablero y `docs/backlog/` se contradicen, se corrige el tablero.

### Calidad del cambio

- **Un bug no se cierra sin reproducirlo, y deja una prueba detrás** (R-08). · _Silencioso._
  Primero se reproduce en un entorno lo más parecido posible a como lo vive el usuario final. **La mitad «deja una prueba» la comprueba CI** (`scripts/fix-con-prueba.mjs`): un commit `fix:` que no toque una prueba pone la build en rojo. Si la prueba no puede ser un fichero, el mensaje lleva una línea `Sin-prueba: <motivo>`. Lo que no es un arreglo no va como `fix:`.
- **Al índice se va por nombre** (R-09). · _Silencioso, auditable._
  `git add <fichero>`, nunca `git add -A` ni `git add .`.
- **Los hooks no se saltan** (R-10). · _Ruidoso._
  Nada de `--no-verify`. Si un hook falla, se investiga la causa.
- **Todo atajo tomado por velocidad se escribe como deuda técnica** (R-11). · _Silencioso, y el que más decae._
  Explícito, con su motivo, en el sitio donde alguien lo vaya a leer: `docs/hallazgos.md` para defectos, `Sin-prueba:` para arreglos sin prueba, el PR para lo que queda abierto.
- **Un lint en rojo, un test que falla o uno flaky se arreglan aunque no los hayas causado** (R-12). · _Silencioso._
- **La documentación desactualizada es peor que no tenerla** (R-13). · _No se puede comprobar._
  Se documenta cuando aporta valor y nunca como ritual. Ninguna comprobación sabe si un documento sigue siendo útil; solo si coincide con el código, que es lo que hace `scripts/verificar-docs.mjs`.
- **Una comprobación cuenta cuando se la ha visto fallar** (R-14). · _Peor que silencioso: da una garantía que no existe._
  Toda comprobación que se añada, al verificador, a CI o a la suite, se demuestra **mutando el código a propósito** y viendo que se pone en rojo **por ese motivo**. **Lo ejecuta CI**: `scripts/mutaciones.mjs` reintroduce defectos que ya existieron y exige el rojo nombrando el motivo. **Al añadir una comprobación, se añade su entrada al catálogo.**

## Lo que no se hace

- No se implementa nada de R2 en adelante (`docs/roadmap.md`) ni de la lista «fuera de alcance» del prompt maestro §88: repositorios privados, clonado, IA local, WhatsApp API, extensiones, Kubernetes, microservicios, Elasticsearch, vector DB externa.
- No se añaden dependencias sin decirlo en el PR y sin motivo escrito. Hay paquetes maliciosos que ciertos modelos sugieren de forma recurrente: cada dependencia nueva se comprueba en el registro de npm antes de instalarla.
- No se edita lo generado (`docs/api/openapi.json` a mano, el esquema generado de Drizzle, `node_modules`).
- No se escribe un secreto en ningún fichero. Los `.env.example` llevan valores vacíos o de ejemplo, y `scripts/verificar-docs.mjs` los revisa. Los tokens de GitHub y de IA no llegan nunca al cliente.
- No se rellena una casilla de trazabilidad, un hallazgo o un informe por aproximación. En blanco es información; inventado es un defecto.
- No se reescribe historial compartido, no se hace `force push`, no se borran ramas, no se toca `upstream`.
