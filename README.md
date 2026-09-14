# RepoGitHubMind

Las URLs de repositorios interesantes de GitHub acaban en chats de WhatsApp, notas y conversaciones, y después no se recuerda qué era cada uno, para qué servía, si se revisó, qué licencia tenía ni si sigue activo. RepoGitHubMind es una biblioteca personal y buscable de repositorios públicos de GitHub: se pega una URL, se guarda con su metadata, la IA lo resume y clasifica, y se reencuentra con una búsqueda en lenguaje natural aunque no se recuerden sus palabras exactas.

Producto open source de **2BCORE** bajo [Apache-2.0](LICENSE) y, a la vez, Proyecto Final del curso AI4Devs de LIDR. El repositorio es también el registro de **cómo** se construye: PRD y specs, trazabilidad de historia a código, decisiones en ADR, y reglas de proceso bajadas a comprobaciones que corren en CI.

> **Estado a 2026-09-14:** Entrega 2 en curso. H1 (cuentas y sesión) y H2 (guardar por URL con la metadata de GitHub, cola y worker) están construidas y verificadas: 67 pruebas, el flujo E2E a escritorio y a 375 px, y el contrato con seis rutas. Las capturas están en [`docs/evidencia/`](docs/evidencia/). H3 sigue en esta entrega.

## Ficha del proyecto

|                             |                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre                      | RepoGitHubMind                                                                                                                                                                                                                                                                                                      |
| Autor                       | RENE LOPEZ LOPEZ · `RLL`                                                                                                                                                                                                                                                                                            |
| Copyright                   | 2026 2BCORE · Apache-2.0 · ver [`NOTICE`](NOTICE)                                                                                                                                                                                                                                                                   |
| Curso                       | AI4Devs · Proyecto Final                                                                                                                                                                                                                                                                                            |
| Repositorio                 | [`rene2bcore/RepoGitHubMind`](https://github.com/rene2bcore/RepoGitHubMind), fuente de verdad                                                                                                                                                                                                                       |
| Entregas académicas         | Fork [`rene2bcore/AI4Devs-finalproject`](https://github.com/rene2bcore/AI4Devs-finalproject) de `LIDR-academy/AI4Devs-finalproject`, ramas `feature/entrega-1-RLL`, `feature/entrega-2-RLL`, `final-project-RLL`. El producto entra allí bajo `producto/` ([ADR-0012](docs/adr/0012-dos-repositorios-y-subtree.md)) |
| Especificación del producto | [`docs/prompts/00-prompt-maestro.md`](docs/prompts/00-prompt-maestro.md)                                                                                                                                                                                                                                            |
| Registro de IA              | [`prompts.md`](prompts.md)                                                                                                                                                                                                                                                                                          |
| Demo                        | Pendiente de la Entrega final: URL por Cloudflare Tunnel o video de 2-3 minutos                                                                                                                                                                                                                                     |

## El flujo que se demuestra

**Entro, pego la URL de un repositorio, lo veo guardado con su metadata y su resumen de IA, le cambio el estado, y lo encuentro después preguntando en lenguaje natural.**

1. Una persona crea una cuenta con email y contraseña y entra directa a su biblioteca vacía.
2. Pega `https://github.com/pgvector/pgvector`. En segundos ve el repositorio guardado con estrellas, licencia, lenguaje y última actividad.
3. Poco después aparece el resumen, el propósito, las categorías y los tags que la IA ha generado. Si la IA falla, el repositorio sigue ahí.
4. Lo marca como «Revisado» y le escribe una nota. Otro usuario que guarde el mismo repositorio no ve ni el estado ni la nota.
5. Días después busca «vectores en postgres» y lo encuentra, aunque esas palabras no aparezcan en el nombre.

Lo recorrerá entero `apps/web/e2e/flujo.e2e.ts` en cada push, desde la pantalla de registro y sin atajar por la API; si esa prueba falla, el producto no se puede demostrar. Entrará en el catálogo de mutaciones con la biblioteca convertida en compartida.

## Arquitectura mínima

```
navegador / PWA ──► Next.js (apps/web, :3000) ──┬──► PostgreSQL 16 + pgvector
                    UI · sesión · /api/v1         │
                                                  │
                    worker (apps/worker) ─────────┘   GitHub REST API · proveedor de IA (reemplazable)
```

Monolito modular en un monorepo pnpm: `apps/web` (UI, sesión propia, Route Handlers y Server Actions), `apps/worker` (cola de trabajos en PostgreSQL: fetch de GitHub, análisis de IA, embeddings), y `packages/` con `db`, `github`, `ai`, `search`, `shared` y `config`. Sin microservicios, sin Redis, sin Elasticsearch, sin vector DB externa.

| Pieza         | Dónde          | Qué hace                                                                                                                                                                                     |
| ------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web           | `apps/web/`    | Pantallas mobile first, autenticación, API bajo `/api/v1` con validación Zod, toda respuesta envuelta en `{ data }` o `{ errors }`                                                           |
| Worker        | `apps/worker/` | Consume `background_jobs`: metadata de GitHub, análisis de IA cacheado por repositorio, embeddings. Idempotente, con backoff                                                                 |
| Base de datos | `docker/`      | PostgreSQL con pgvector. `repogithubmind` en desarrollo y `repogithubmind_test` en pruebas, sin forma de cruzarlas ([ADR-0003](docs/adr/0003-aislamiento-de-la-base-de-datos-en-pruebas.md)) |

Diagramas C4 y el detalle por módulo: [`docs/architecture.md`](docs/architecture.md). Modelo de datos: [`docs/data-model.md`](docs/data-model.md). Cómo se elige y se cachea la IA: [`docs/ai-architecture.md`](docs/ai-architecture.md). Lo que el sistema debe hacer: [`docs/specs/`](docs/specs/).

## Historias y tickets

Vertical académica de MVP-R1. Lo que MVP-R1 incluye y esta vertical no, en [`docs/roadmap.md`](docs/roadmap.md).

| Historia                                                                                                        | Jira  | Prioridad   | Estado                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ----- | ----------- | ------------------------------------------------------------------------- |
| [H1 · Cuentas y sesión](docs/backlog/RGM-2-cuentas-y-sesion.md)                                                 | RGM-2 | must-have   | Construida en la Entrega 2 (RGM-9 datos, RGM-10 backend, RGM-11 frontend) |
| [H2 · Guardar un repositorio por URL con metadata de GitHub](docs/backlog/RGM-3-guardar-repositorio-por-url.md) | RGM-3 | must-have   | Construida en la Entrega 2                                                |
| [H3 · Mi biblioteca: estado, favorito, rating y notas](docs/backlog/RGM-4-mi-biblioteca.md)                     | RGM-4 | must-have   | Por hacer                                                                 |
| [H4 · Análisis de IA cacheado con proveedor reemplazable](docs/backlog/RGM-5-analisis-ia.md)                    | RGM-5 | must-have   | Por hacer                                                                 |
| [H5 · Búsqueda híbrida en lenguaje natural](docs/backlog/RGM-6-busqueda-hibrida.md)                             | RGM-6 | must-have   | Por hacer                                                                 |
| [S1 · Importación masiva desde texto o `.txt`](docs/backlog/RGM-7-importacion-masiva.md)                        | RGM-7 | should-have | Por hacer                                                                 |
| [S2 · Repositorios similares](docs/backlog/RGM-8-repositorios-similares.md)                                     | RGM-8 | should-have | Por hacer                                                                 |

El backlog completo, con la matriz de impacto y el orden: [`docs/backlog/README.md`](docs/backlog/README.md). Qué criterio tiene prueba y cuál no: [`docs/traceability.md`](docs/traceability.md).

## Requisitos

|                        | Versión             | Nota                                                                                             |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| Node.js                | **24**              | La que usa CI; `.nvmrc` la fija                                                                  |
| pnpm                   | **10**              | `packageManager` en el `package.json` raíz                                                       |
| Docker                 | cualquiera reciente | Para PostgreSQL con pgvector en local                                                            |
| Git                    | cualquiera reciente | `git config core.hooksPath .githooks` activa los hooks; `pnpm install` lo hace solo              |
| GNU Make               | opcional            | Solo para los atajos. Windows sin WSL no está soportado por el `Makefile`; ahí se arranca a mano |
| Chromium de Playwright | opcional            | Solo para las pruebas de navegador                                                               |

## Instalación

Con `make` (macOS, Linux, WSL):

```bash
git clone https://github.com/rene2bcore/RepoGitHubMind.git
cd RepoGitHubMind
make setup   # instala dependencias, crea .env, levanta postgres, migra y siembra
make start   # web en :3000 y worker a la vez; Ctrl-C para los dos
```

A mano, en cualquier sistema:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev                         # http://localhost:3000
```

### Variables de entorno

Los `.env.example` no llevan valores reales; `scripts/verificar-docs.mjs` lo comprueba. Los tokens de GitHub y de IA viven solo en el servidor.

| Variable                                      | Qué es                                                                                                                                                                                 | Ejemplo                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                                | PostgreSQL de desarrollo                                                                                                                                                               | `postgres://rgm:rgm@localhost:5434/repogithubmind` |
| `AUTH_SECRET`                                 | Secreto del servidor para la sesión. Se genera con `openssl rand -base64 32`                                                                                                           | vacío                                              |
| `AUTH_URL`                                    | URL pública de la app                                                                                                                                                                  | `http://localhost:3000`                            |
| `GITHUB_FAKE`                                 | `1` para desarrollar y probar sin red, con respuestas grabadas de GitHub                                                                                                               | `0`                                                |
| `GITHUB_TOKEN`                                | Token de solo lectura para ampliar el rate limit de la REST API. Opcional                                                                                                              | vacío                                              |
| `AI_ANALYSIS_ENABLED`                         | Interruptor del análisis de IA                                                                                                                                                         | `true`                                             |
| `AI_PROVIDER`, `AI_MODEL_ANALYSIS`            | Proveedor y modelo del análisis. Nunca hardcodeados                                                                                                                                    | `openrouter`, vacío                                |
| `AI_EMBEDDING_PROVIDER`, `AI_MODEL_EMBEDDING` | Proveedor y modelo de embeddings                                                                                                                                                       | `openrouter`, vacío                                |
| `AI_API_KEY`                                  | Clave del proveedor. Solo servidor                                                                                                                                                     | vacío                                              |
| `AI_MAX_README_CHARS`, `AI_ANALYSIS_TTL_DAYS` | Truncado del README y caducidad del análisis                                                                                                                                           | `12000`, `90`                                      |
| `TRUST_PROXY`                                 | Solo `true` detrás de un proxy propio (Cloudflare Tunnel): es quien escribe la dirección del cliente en las cabeceras. Sin proxy, cualquiera las falsifica ([H-07](docs/hallazgos.md)) | `false`                                            |
| `DEBUG_HTTP_ERRORS`                           | Volcado de depuración en las respuestas. Apagado en todos los entornos ([ADR-0004](docs/adr/0004-el-volcado-de-depuracion-va-apagado.md))                                              | `false`                                            |

## Comandos

Todos desde la raíz del monorepo.

| Qué                      | Comando                                             |
| ------------------------ | --------------------------------------------------- |
| Arrancar en desarrollo   | `pnpm dev`                                          |
| Pruebas                  | `pnpm test` (Vitest) y `pnpm test:e2e` (Playwright) |
| Lint, tipos, formato     | `pnpm lint`, `pnpm typecheck`, `pnpm format:check`  |
| Dependencias vulnerables | `pnpm audit --audit-level=high`                     |
| Contrato OpenAPI         | `pnpm openapi:generate` y `pnpm openapi:check`      |
| Base de datos            | `pnpm db:migrate`, `pnpm db:seed`                   |

Desde la raíz, sin dependencias, dos scripts de CI que también sirven en local:

```bash
node scripts/verificar-docs.mjs   # la documentación corresponde con el código
node scripts/mutaciones.mjs       # cada comprobación se pone en rojo con el defecto que dice cubrir
```

La lista completa en [`CLAUDE.md`](CLAUDE.md).

## Flujo de contribución

1. **Una historia empieza en Jira** (`RGM-n`) con la skill `/priority-ticket`, y **una rama por unidad de trabajo** desde `main`: `git switch -c feat/RGM-n-<slug>`. Commitear en `main` lo impide el hook `.githooks/pre-commit`.
2. **Si cambia el comportamiento, primero la spec.** Un delta-spec en `docs/specs/` se revisa antes de escribir código.
3. **Un bug se reproduce antes de arreglarlo, y deja una prueba.** CI rechaza un commit `fix:` que no toque una prueba, salvo que el mensaje lleve `Sin-prueba: <motivo>`.
4. **Si tocas Route Handlers, esquemas Zod o serializadores**, en el mismo commit `pnpm openapi:generate` y el README de la capability.
5. **Al índice por nombre** (`git add <fichero>`), commits convencionales (`tipo(ámbito): qué`; el hook `commit-msg` rechaza lo demás) y **nunca `--no-verify`**.
6. **Antes de abrir el PR**, lo mismo que corre CI. Si añades una prueba, actualiza su número en `CLAUDE.md`.
7. **Un solo PR al terminar la unidad**, con la plantilla de `.github/PULL_REQUEST_TEMPLATE.md` rellena, incluida «Lo que este PR NO arregla». El revisor adversarial corre solo en cada push de una rama con PR abierto.

Más en [`CONTRIBUTING.md`](CONTRIBUTING.md). Qué comprueba CI y cómo se lee cuando falla: [`docs/runbooks.md`](docs/runbooks.md). Las reglas completas, con el modo de fallo de cada una: [`CLAUDE.md`](CLAUDE.md).

## Documentación

| Qué                                                                   | Dónde                                                                                                                                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Producto: PRD, backlog y roadmap                                      | [`docs/prd.md`](docs/prd.md), [`docs/backlog/README.md`](docs/backlog/README.md), [`docs/roadmap.md`](docs/roadmap.md)                                                                                             |
| Specs vivas                                                           | [`docs/specs/`](docs/specs/)                                                                                                                                                                                       |
| Trazabilidad ticket, criterio, prueba y código; estrategia de pruebas | [`docs/traceability.md`](docs/traceability.md), [`docs/estrategia-de-pruebas.md`](docs/estrategia-de-pruebas.md)                                                                                                   |
| Arquitectura, modelo de datos, taxonomía, IA y decisiones             | [`docs/architecture.md`](docs/architecture.md), [`docs/data-model.md`](docs/data-model.md), [`docs/taxonomy.md`](docs/taxonomy.md), [`docs/ai-architecture.md`](docs/ai-architecture.md), [`docs/adr/`](docs/adr/) |
| Contrato de la API                                                    | [`docs/api/openapi.json`](docs/api/openapi.json)                                                                                                                                                                   |
| Despliegue, operación, CI e incidentes                                | [`docs/deployment-local.md`](docs/deployment-local.md), [`docs/deployment-hostinger.md`](docs/deployment-hostinger.md), [`docs/runbooks.md`](docs/runbooks.md)                                                     |
| Hallazgos y su estado                                                 | [`docs/hallazgos.md`](docs/hallazgos.md)                                                                                                                                                                           |
| Reglas de proceso y su auditoría                                      | [`CLAUDE.md`](CLAUDE.md), [`docs/auditoria-reglas-de-proceso.md`](docs/auditoria-reglas-de-proceso.md)                                                                                                             |
| Revisor automático                                                    | [`REVIEW.md`](REVIEW.md), [`docs/ci-revisor.md`](docs/ci-revisor.md)                                                                                                                                               |
| Seguridad y conducta                                                  | [`SECURITY.md`](SECURITY.md), [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)                                                                                                                                           |
| Instrucciones para agentes                                            | [`CLAUDE.md`](CLAUDE.md) (y [`AGENTS.md`](AGENTS.md), que apunta a él)                                                                                                                                             |

## Trademark and Branding

El código se publica bajo Apache-2.0, que permite el uso comercial. Los nombres y logos «RepoGitHubMind» y «2BCORE» son marcas de 2BCORE y **no se transfieren** por la licencia del código: quien redistribuya o modifique el software no adquiere derecho a usarlos como propios. Sujeto a revisión jurídica posterior.
