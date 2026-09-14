# Arquitectura de RepoGitHubMind

Tres niveles del modelo C4, de fuera hacia dentro: el **contexto** dice con quién habla el sistema, los **contenedores** qué piezas se ejecutan por separado, y los **componentes** qué hay dentro de cada una. Los diagramas son Mermaid dentro de este fichero, así que se versionan y se revisan en el mismo diff que el código que describen.

> **Estado a 2026-09-14:** no hay código todavía ([H-01](hallazgos.md)). Todo lo dibujado es lo decidido en el [prompt maestro](prompts/00-prompt-maestro.md) §44 a §46 y en los ADR; a partir de la Entrega 2, lo que no se pueda verificar leyendo ficheros se quita del dibujo, no al revés.

## Patrón, y por qué

**Monolito modular** ([ADR-0006](adr/0006-monolito-modular.md)): una aplicación Next.js con módulos de dominio bien separados (Auth, Repository, Library, Import, Search, Recommendation, AI, GitHub, Jobs), un worker aparte que consume una cola en PostgreSQL, y **PostgreSQL + pgvector como única infraestructura de datos** ([ADR-0007](adr/0007-postgresql-y-pgvector.md)): datos relacionales, texto completo, vectores y cola de trabajos en el mismo motor.

Lo que aporta: una sola cosa que desplegar y respaldar, un solo `docker compose`, coste de un VPS, y módulos que pueden convertirse en servicios el día que una métrica real lo pida. Lo que sacrifica: el worker y la web comparten base y versión de esquema, así que se despliegan juntos; y la búsqueda vectorial en PostgreSQL rinde peor que una vector DB dedicada por encima de cientos de miles de repositorios, que no es el volumen del MVP.

Dentro de la aplicación, la lógica de negocio no vive en componentes React ni en Route Handlers: `UI → servicios de aplicación → dominio → infraestructura` (§79), sin la ceremonia de una Clean Architecture completa.

## Diagrama de contexto

El sistema en ejecución y su ciclo de desarrollo se dibujan juntos pero fallan de forma distinta: si GitHub Actions o Anthropic no responden, el producto sigue funcionando y lo que se para es la verificación. Si la REST API de GitHub o el proveedor de IA no responden, se puede seguir entrando, viendo y buscando; lo que se para es guardar repositorios nuevos y analizarlos.

```mermaid
C4Context
    title Diagrama de contexto de RepoGitHubMind

    Person(usuario, "Persona que colecciona repositorios", "Guarda URLs de GitHub y las reencuentra buscando en lenguaje natural desde el navegador o el movil")
    System(rgm, "RepoGitHubMind", "Biblioteca personal y buscable de repositorios publicos de GitHub con resumen y clasificacion por IA")

    System_Ext(githubapi, "GitHub REST API", "Metadata README licencia topics lenguajes y releases de repositorios publicos")
    System_Ext(ia, "Proveedor de IA", "Analisis estructurado y embeddings. Reemplazable por configuracion: OpenRouter OpenAI Anthropic Google")

    Person(dev, "Quien desarrolla", "Escribe specs codigo y pruebas y abre el PR")
    System_Ext(github, "GitHub", "Repositorio fuente de verdad y Actions con la verificacion en cada push")
    System_Ext(anthropic, "Anthropic", "API de Claude que usa el revisor adversarial desde CI")
    System_Ext(jira, "Jira", "Tablero RGM de seguimiento. No es fuente de verdad")

    Rel(usuario, rgm, "Usa desde el navegador", "HTTPS")
    Rel(rgm, githubapi, "Pide metadata con token de solo lectura del servidor", "HTTPS")
    Rel(rgm, ia, "Pide analisis y embeddings desde el worker", "HTTPS")
    Rel(dev, github, "Empuja ramas y abre PR")
    Rel(github, anthropic, "Pide la revision del diff", "claude -p")
    Rel(dev, jira, "Sigue el trabajo")
```

## Diagrama de contenedores

```mermaid
C4Container
    title Diagrama de contenedores de RepoGitHubMind

    Person(usuario, "Persona que colecciona repositorios", "")
    System_Ext(githubapi, "GitHub REST API", "")
    System_Ext(ia, "Proveedor de IA", "")

    System_Boundary(rgm, "RepoGitHubMind") {
        Container(web, "Web", "Next.js App Router en apps/web, puerto 3000", "Pantallas mobile first, sesion propia con cookie HttpOnly (ADR-0013), Route Handlers bajo /api/v1 y Server Actions. Toda respuesta envuelta en data o errors")
        Container(worker, "Worker", "Proceso Node en apps/worker", "Consume la cola background_jobs: fetch de GitHub, analisis de IA, embeddings. Idempotente con backoff")
        ContainerDb(db, "PostgreSQL 16 + pgvector", "Docker, una base por entorno", "Usuarios y sesiones, repositorios globales, relaciones privadas por usuario, analisis, embeddings, taxonomia, cola de trabajos y uso de IA")
    }

    Rel(usuario, web, "Usa", "HTTPS")
    Rel(web, db, "Lee y escribe con Drizzle", "SQL")
    Rel(web, db, "Encola trabajos al guardar un repositorio", "SQL")
    Rel(worker, db, "Toma trabajos y escribe resultados", "SQL")
    Rel(worker, githubapi, "Metadata README topics lenguajes releases", "HTTPS")
    Rel(worker, ia, "Analisis estructurado y embeddings", "HTTPS")
```

**Por qué el worker es un proceso aparte y no una ruta de Next.js**: el análisis de IA tarda decenas de segundos y guardar un repositorio no puede esperar (§68). El worker vive en el mismo monorepo y en la misma imagen base; en desarrollo puede correr fuera de Docker.

## Diagramas de componentes

### Dentro de la web

Las flechas son dependencias leídas de los imports una vez exista el código, no llamadas en tiempo de ejecución.

```mermaid
C4Component
    title Componentes de apps/web

    ContainerDb_Ext(db, "PostgreSQL", "")
    Container_Ext(worker, "Worker", "")

    Container_Boundary(web, "Web") {
        Component(pages, "Pantallas", "app/ con App Router", "login register library repositories/[id] search import. Mobile first con bottom navigation y sidebar en escritorio")
        Component(api, "Cliente de la API", "src/lib/api.ts", "Unico punto de contacto del cliente con /api/v1. Desenvuelve data y traduce errors")
        Component(routes, "Route Handlers", "app/api/v1/**/route.ts", "Validan con Zod antes de resolver ids. Devuelven data o errors. Generan el contrato OpenAPI")
        Component(auth, "Auth", "src/lib/session.ts sobre la tabla sessions (ADR-0013)", "Credenciales email y contrasena con bcrypt. getSessionUser es la unica fuente de identidad")
        Component(services, "Servicios de aplicacion", "src/modules/*", "repository library import search recommendation. La logica de negocio vive aqui, no en React")
        Component(errors, "Manejador de errores", "src/lib/errors.ts", "Forma unica de error. Un 5xx nunca revela traza ni SQL")
        Component(shared, "packages/shared", "Tipos errores tipados esquemas Zod", "Compartido con el worker")
        Component(dbpkg, "packages/db", "Esquema Drizzle migraciones seeds", "Elige la base segun el entorno")
    }

    Rel(pages, api, "")
    Rel(api, routes, "fetch")
    Rel(routes, auth, "")
    Rel(routes, services, "")
    Rel(services, dbpkg, "")
    Rel(services, shared, "")
    Rel(routes, errors, "")
    Rel(dbpkg, db, "SQL")
    Rel(services, db, "Encola IMPORT_REPOSITORY y ANALYZE_REPOSITORY")
```

### Dentro del worker

```mermaid
C4Component
    title Componentes de apps/worker

    ContainerDb_Ext(db, "PostgreSQL", "")
    System_Ext(githubapi, "GitHub REST API", "")
    System_Ext(ia, "Proveedor de IA", "")

    Container_Boundary(worker, "Worker") {
        Component(queue, "Cola", "pg-boss o equivalente sobre PostgreSQL", "QUEUED PROCESSING COMPLETED FAILED. Reintentos con backoff. Sin Redis")
        Component(jobs, "Trabajos", "src/jobs/*", "IMPORT_REPOSITORY REFRESH_REPOSITORY ANALYZE_REPOSITORY GENERATE_EMBEDDING BULK_IMPORT. Idempotentes")
        Component(githubpkg, "packages/github", "GitHubProvider", "REST API con cabeceras de version y respeto al rate limit. Nunca expone el token")
        Component(aipkg, "packages/ai", "AIProvider y AIProviderRegistry", "analyzeRepository y createEmbedding. Proveedor por variables AI_*. Salida validada con Zod. Registra AIUsage")
        Component(searchpkg, "packages/search", "Indexacion", "Construye el texto semantico y el tsvector de cada repositorio")
    }

    Rel(queue, jobs, "")
    Rel(jobs, githubpkg, "")
    Rel(jobs, aipkg, "")
    Rel(jobs, searchpkg, "")
    Rel(githubpkg, githubapi, "HTTPS")
    Rel(aipkg, ia, "HTTPS")
    Rel(jobs, db, "SQL")
```

## Estructura de ficheros

```text
RepoGitHubMind/
  apps/
    web/            Next.js: app/, src/modules/, src/lib/, e2e/, tests/
    worker/         Proceso Node: src/jobs/, src/index.ts, tests/
  packages/
    db/             Esquema Drizzle, migraciones, seeds, cliente que elige la base por entorno
    github/         GitHubProvider
    ai/             AIProvider, AIProviderRegistry, prompts, esquemas de salida
    search/         Texto semántico, tsvector, RRF
    shared/         Tipos, errores tipados, esquemas Zod, normalizador de URL
    config/         eslint, prettier, tsconfig compartidos
  docker/           docker-compose.yml: postgres (pgvector), web, worker
  docs/             Este directorio
  scripts/          Lo que CI ejecuta: verificador, mutaciones, hooks
  .github/          Workflows de verificación y revisión adversarial
  .githooks/        pre-commit y commit-msg
```

pnpm workspaces sin Turborepo mientras no haga falta (§45).

## Infraestructura y despliegue

```mermaid
flowchart LR
    subgraph dev["Desarrollo local"]
        pg[(postgres + pgvector<br/>Docker)]
        w[web :3000]
        k[worker]
        w --> pg
        k --> pg
    end
    subgraph r1["Demo R1"]
        cf[Cloudflare Tunnel] --> w
    end
    subgraph vps["Hostinger VPS (objetivo)"]
        dc[docker compose: postgres web worker]
        bk[backups diarios de PostgreSQL]
        cfp[Cloudflare DNS + HTTPS] --> dc
        dc --> bk
    end
```

Primera etapa: localhost expuesto por Cloudflare Tunnel sin abrir puertos ([`deployment-local.md`](deployment-local.md)). Objetivo: un VPS Ubuntu con Docker Compose, Cloudflare delante y backups diarios ([`deployment-hostinger.md`](deployment-hostinger.md)). Nada depende de Vercel ni de Cloudflare Workers.

## Seguridad

Lo que se comprueba y cómo, en [`SECURITY.md`](../SECURITY.md). Las tres decisiones que más pesan sobre el dibujo: la identidad sale siempre de la sesión en el servidor; los tokens de GitHub y de IA solo los tiene el worker y los Route Handlers, nunca el cliente; y ningún error devuelve traza ni SQL ([ADR-0004](adr/0004-el-volcado-de-depuracion-va-apagado.md)).

## Decisiones que explican esta forma

| Decisión                                         | ADR                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Monolito modular con worker aparte               | [0006](adr/0006-monolito-modular.md)                                        |
| PostgreSQL + pgvector para todo                  | [0007](adr/0007-postgresql-y-pgvector.md)                                   |
| `Repository` global y `UserRepository` privada   | [0008](adr/0008-repository-global-y-userrepository-privada.md)              |
| Proveedor de IA reemplazable y análisis cacheado | [0009](adr/0009-proveedor-de-ia-reemplazable.md)                            |
| Cola de trabajos en PostgreSQL                   | [0010](adr/0010-cola-de-trabajos-en-postgresql.md)                          |
| Contrato generado desde Zod y vigilado           | [0001](adr/0001-el-contrato-se-genera-se-versiona-y-se-vigila-la-deriva.md) |
| Dos repositorios y `git subtree`                 | [0012](adr/0012-dos-repositorios-y-subtree.md)                              |
