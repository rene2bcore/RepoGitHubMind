# REPogitHubMind — MASTER DEVELOPMENT PROMPT

Actúa como **Principal Software Architect, Staff Full-Stack Engineer, Product Engineer, UX Architect y DevSecOps Engineer**.

Tu misión es diseñar e implementar un producto real llamado:

# RepoGitHubMind

**Autor / Copyright:** 2BCORE  
**Licencia inicial:** Apache License 2.0  
**Tipo:** Open Source  
**Producto:** Web PWA multiusuario para descubrir, almacenar, clasificar, analizar y recuperar repositorios públicos de GitHub mediante búsqueda tradicional, búsqueda semántica e inteligencia artificial.

No construyas solamente un prototipo académico.

Diseña RepoGitHubMind como un producto mantenible, extensible y desplegable que pueda evolucionar posteriormente a miles de usuarios y cientos de miles de repositorios.

Sin embargo, aplica estrictamente:

> Time to Market > sobrearquitectura.

El primer objetivo es liberar rápidamente **MVP-R1**.

No implementes funcionalidades de R2, R3 o posteriores dentro del MVP salvo las abstracciones estrictamente necesarias para no bloquear la evolución futura.

---

# 1. CONTEXTO DEL PROYECTO

El problema original es el siguiente:

Frecuentemente encontramos repositorios interesantes de GitHub navegando por:

- WhatsApp
- X
- Reddit
- Hacker News
- artículos
- blogs
- GitHub
- videos
- conversaciones
- ChatGPT
- Claude
- recomendaciones de otras personas

Actualmente muchas URLs terminan almacenadas de manera informal en chats de WhatsApp u otras herramientas.

Después resulta difícil recordar:

- qué repositorio era;
- para qué servía;
- si ya lo revisé;
- si lo instalé;
- qué licencia tenía;
- si continúa activo;
- cuándo fue actualizado;
- qué alternativas existen;
- qué repositorios parecidos tengo;
- qué repositorios similares conocen otros usuarios;
- cuál es mejor para un problema específico.

RepoGitHubMind debe solucionar ese problema.

No debe comportarse como un simple bookmark manager.

Debe convertirse progresivamente en:

> **una biblioteca inteligente y buscable de software open source basada principalmente en repositorios GitHub.**

---

# 2. PRINCIPIOS DEL PRODUCTO

Diseña usando estos principios:

1. Simple primero.
2. Mobile First.
3. PWA real.
4. Multiusuario desde MVP.
5. Las bibliotecas personales son privadas.
6. Los repositorios GitHub son entidades públicas/globales.
7. No duplicar análisis del mismo repositorio innecesariamente.
8. AI debe ser reemplazable.
9. Costos mínimos.
10. PostgreSQL debe resolver la mayor cantidad posible de necesidades.
11. No introducir microservicios prematuramente.
12. No introducir Elasticsearch/OpenSearch en MVP.
13. No introducir una Vector DB separada.
14. No utilizar IA local.
15. No clonar repositorios completos durante MVP.
16. La experiencia principal debe funcionar perfectamente desde:
    - navegador desktop;
    - iPhone;
    - Android;
    - PWA instalada.

---

# 3. MODELO CONCEPTUAL FUNDAMENTAL

Debes separar explícitamente:

## Repository

Entidad GLOBAL.

Representa el repositorio público GitHub.

Ejemplo:

```text
github.com/pgvector/pgvector
```

Debe existir solamente una vez en la base global aunque 10,000 usuarios lo guarden.

Contendrá información pública como:

- owner
- name
- fullName
- GitHub repository ID
- URL
- description
- homepage
- topics
- primary language
- languages
- stars
- forks
- watchers cuando sea útil
- open issues
- license
- default branch
- archived
- fork
- createdAt GitHub
- updatedAt GitHub
- pushedAt GitHub
- latest release
- latest release date
- README
- AI summary
- AI classification
- installation summary
- maturity information
- activity information
- repository vectors/embeddings
- analysis timestamps

---

## UserRepository

Entidad PRIVADA perteneciente al usuario.

Representa que determinado usuario guardó determinado repositorio.

Ejemplo:

```text
René
     ↓
UserRepository
     ↓
pgvector/pgvector
```

Debe contener información personal como:

- status
- rating
- favorite
- notes
- personalTags
- collections
- dateSaved
- dateReviewed
- source
- sourceText opcional
- custom title opcional

Los datos personales:

```text
notes
status
rating
collections
personalTags
```

NUNCA deberán ser visibles a otros usuarios.

---

# 4. PRIVACIDAD + INTELIGENCIA COLECTIVA

Un usuario puede ver repositorios que otros usuarios hayan guardado, porque los repositorios son públicos.

Sin embargo:

NO deberá poder ver:

- quién lo guardó;
- las notas de otra persona;
- su estado;
- sus colecciones;
- sus tags privados;
- sus valoraciones privadas.

Podemos mostrar agregados anónimos como:

```text
Guardado por 132 usuarios
```

si posteriormente resulta útil.

La inteligencia colectiva deberá funcionar a nivel:

```text
Repository
```

NO:

```text
UserRepository
```

Esto permitirá reutilizar análisis y reducir costos de IA.

---

# 5. CASO PRINCIPAL

El usuario encuentra:

```text
https://github.com/pgvector/pgvector
```

Lo pega en RepoGitHubMind.

El sistema:

1. valida que sea GitHub;
2. normaliza URL;
3. identifica `owner/repository`;
4. verifica si Repository ya existe;
5. obtiene metadata GitHub;
6. obtiene README;
7. obtiene licencia;
8. obtiene topics;
9. obtiene lenguajes;
10. obtiene información de releases;
11. almacena datos;
12. ejecuta análisis IA solamente si corresponde;
13. clasifica el proyecto;
14. genera resumen;
15. genera embeddings;
16. relaciona repositorio al usuario;
17. calcula similares;
18. muestra inmediatamente el resultado.

---

# 6. IMPORTACIÓN MASIVA

MVP deberá soportar:

### A. URL individual

Campo:

```text
Paste GitHub URL
```

Ejemplo:

```text
https://github.com/langchain-ai/langgraph
```

---

### B. Texto plano pegado

El usuario podrá pegar textos largos provenientes de:

- WhatsApp
- notas
- chats
- documentos
- exports

El sistema detectará automáticamente cualquier URL:

```regex
github.com/{owner}/{repo}
```

Debe:

1. extraer URLs;
2. eliminar duplicados;
3. normalizar URLs;
4. ignorar URLs no válidas;
5. mostrar preview antes de importar.

Ejemplo:

```text
Encontramos 137 repositorios

Nuevos: 108
Ya guardados: 21
Inválidos: 8
```

---

### C. Archivo `.txt`

Debe permitirse:

```text
Upload .txt
```

Especialmente diseñado para exports de WhatsApp.

No almacenar el archivo original permanentemente salvo que exista una razón técnica explícita.

Procesarlo.

Extraer URLs GitHub.

Descartar el contenido restante cuando termine el procesamiento.

---

# 7. NO INTEGRAR WHATSAPP DIRECTAMENTE EN MVP

No crear integración API con WhatsApp.

No pedir acceso a WhatsApp.

No intentar leer conversaciones.

MVP solamente requiere:

```text
Paste Text
Upload TXT
Paste GitHub URL
```

Posteriormente se podrá evaluar Share Target, extensiones o integraciones adicionales.

---

# 8. PWA

RepoGitHubMind deberá ser una Progressive Web App.

Debe funcionar correctamente en:

- iOS Safari
- Android Chrome
- Desktop Chrome
- Edge
- Safari desktop

Debe tener:

```text
manifest.json
icons
installability
responsive interface
service worker
offline shell
cache
offline repository viewing
pending action queue
```

NO utilizar IA local.

Cuando no exista conexión:

permitir:

- abrir repositorios previamente cacheados;
- consultar información previamente descargada;
- cambiar estado;
- agregar notas;
- marcar favorito;
- cambiar rating.

Las operaciones deberán guardarse localmente y sincronizarse cuando regrese Internet.

La IA requiere conexión.

---

# 9. STACK TECNOLÓGICO

Utiliza preferentemente:

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
Lucide Icons
```

Utilizar App Router.

---

## Backend

Inicialmente:

```text
Next.js Server Actions
Next.js Route Handlers
```

No crear backend independiente salvo necesidad real.

---

## Database

```text
PostgreSQL
pgvector
```

ORM recomendado:

```text
Drizzle ORM
```

Si existe una razón técnica claramente superior para Prisma, documentarla antes de cambiar.

Default:

```text
Drizzle
```

---

## Authentication

Implementar autenticación multiusuario mediante una solución open source/madura compatible con Next.js.

Preferentemente:

```text
Auth.js
```

Debe soportar inicialmente:

```text
email/password
```

y preparar la arquitectura para agregar:

```text
GitHub OAuth
Google
```

posteriormente.

No depender de GitHub para tener cuenta en RepoGitHubMind.

---

# 10. GITHUB

MVP solamente soportará:

> PUBLIC GitHub repositories.

No analizar repositorios privados.

No solicitar acceso a repositorios privados.

Utilizar:

```text
GitHub REST API
```

con una abstracción:

```text
GitHubProvider
```

La API debe obtener como mínimo:

```text
repository
topics
languages
license
README
releases
```

Mantener API versioning y headers recomendados por GitHub.

Cuando sea posible utilizar requests autenticadas del backend para ampliar rate limits.

Nunca exponer tokens GitHub al cliente.

---

# 11. GITHUB AUTH NO ES OBLIGATORIO PARA MVP

No hacer obligatorio enlazar una cuenta GitHub.

RepoGitHubMind debe funcionar solamente con su propia cuenta.

Posteriormente GitHub OAuth puede agregar:

- import stars;
- navegación personalizada;
- perfiles GitHub.

Pero NO forma parte del alcance obligatorio MVP-R1.

---

# 12. DATOS VISIBLES DE CADA REPOSITORIO

El card de cada repositorio debe ser compacto.

Debe mostrar aproximadamente:

```text
┌─────────────────────────────────────────┐
│ pgvector / pgvector                     │
│                                         │
│ ⭐ 19.4k     MIT     PostgreSQL          │
│                                         │
│ Vector similarity search for Postgres   │
│                                         │
│ AI · Database · Vector Search           │
│                                         │
│ Updated: 2 days ago                     │
│                                         │
│ ★ Favorite                REVIEWED      │
└─────────────────────────────────────────┘
```

Prioridad visual:

1. nombre;
2. descripción/resumen;
3. estrellas;
4. licencia;
5. lenguaje;
6. categorías;
7. última actualización;
8. estado personal.

La licencia debe aparecer siempre junto con las métricas principales cuando GitHub pueda identificarla.

Ejemplo:

```text
⭐ 24.3k • MIT • TypeScript
```

---

# 13. DIFERENCIAR FECHAS

Guardar por separado:

```text
githubCreatedAt
githubUpdatedAt
githubPushedAt
latestReleaseAt
metadataRefreshedAt
aiAnalyzedAt
```

En UI mostrar principalmente:

```text
Última actividad
```

basada prioritariamente en `pushedAt`.

Opcionalmente tooltip:

```text
Código: 10 Sep 2026
Metadata: 11 Sep 2026
Release: 7 Sep 2026
```

---

# 14. ESTADOS PERSONALES

Usar:

```text
NEW
TO_REVIEW
REVIEWED
TESTING
INSTALLED
USING
FAVORITE
REJECTED
ARCHIVED
```

Un favorito puede adicionalmente representarse con:

```text
favorite boolean
```

para evitar acoplarlo exclusivamente al status.

---

# 15. TAXONOMÍA

Usar:

> Controlled hierarchical taxonomy + AI recommendations.

NO permitir que la IA cree indiscriminadamente categorías raíz.

Ejemplo:

```text
Artificial Intelligence
├── Agents
│   ├── Agent Frameworks
│   ├── Multi-Agent
│   ├── Agent Orchestration
│   ├── Agent Memory
│   └── Agent Tools
│
├── LLM
│   ├── Inference
│   ├── RAG
│   ├── Embeddings
│   └── Evaluation
│
Media
├── Image
│   ├── Generation
│   ├── Editing
│   └── Computer Vision
│
├── Audio
│   ├── Voice
│   ├── Speech-to-Text
│   ├── Text-to-Speech
│   └── Audio Editing
│
Developer Tools
├── IDE
├── CLI
├── Testing
├── Documentation
├── Code Analysis
└── DevOps
```

Debe ser modificable por administradores.

La IA podrá sugerir:

```text
categorySuggestion
subcategorySuggestion
tags
```

pero las categorías oficiales se deberán mapear al catálogo existente.

---

# 16. TAGS

Separar:

```text
controlled categories
```

de:

```text
AI tags
user tags
GitHub topics
```

Los GitHub topics no deben convertirse automáticamente en categorías.

---

# 17. ANÁLISIS AI

El análisis MVP debe ser ECONÓMICO.

No enviar todo el repositorio.

No clonar código.

Contexto principal:

```text
GitHub metadata
README
topics
languages
license
release metadata
```

Generar salida estructurada JSON.

Ejemplo:

```json
{
  "summary": "",
  "purpose": "",
  "mainUseCases": [],
  "categories": [],
  "tags": [],
  "installationSummary": "",
  "deploymentType": [],
  "frameworks": [],
  "maturity": "",
  "advantages": [],
  "limitations": [],
  "targetUsers": [],
  "activityAssessment": "",
  "abandonmentRisk": "",
  "aiConfidence": 0
}
```

Mantener resultados muy resumidos.

Ejemplo summary:

máximo aproximadamente 200 caracteres.

Advantages:

máximo 3.

Limitations:

máximo 3.

Use cases:

máximo 5.

---

# 18. AI PROVIDER ABSTRACTION

No acoplar RepoGitHubMind a Claude/OpenAI.

Crear:

```typescript
interface AIProvider {
  analyzeRepository(input): Promise<RepositoryAnalysis>;
  createEmbedding(input): Promise<number[]>;
}
```

Crear una capa:

```text
AIProviderRegistry
```

La configuración deberá permitir cambiar proveedor vía variables de entorno/database.

---

# 19. PROVEEDORES AI

Evaluar principalmente APIs cloud económicas.

Soportar progresivamente:

```text
OpenRouter
Groq
OpenAI
Anthropic
Google
Moonshot/Kimi
Qwen-compatible APIs
```

ACLARACIÓN:

Herramientas como:

```text
Claude Code
Codex
Cline
```

son herramientas/agentes de desarrollo y NO deberán confundirse con los proveedores runtime de AI de RepoGitHubMind.

---

# 20. ESTRATEGIA AI DE COSTO

Implementar:

```text
AI_PROVIDER
AI_MODEL_ANALYSIS
AI_MODEL_EMBEDDING
```

mediante `.env`.

Ejemplo conceptual:

```env
AI_PROVIDER=openrouter
AI_MODEL_ANALYSIS=...
AI_EMBEDDING_PROVIDER=...
AI_MODEL_EMBEDDING=...
```

Nunca hardcodear modelos específicos.

Implementar fallback:

```text
Primary Provider
        ↓ failure
Secondary Provider
```

pero en MVP puede existir solamente un proveedor configurado.

---

# 21. CACHE DE ANÁLISIS AI

La IA debe operar sobre Repository global.

NO ejecutar nuevamente el análisis por cada usuario.

Ejemplo:

Usuario A guarda LangGraph.

Se analiza.

Usuario B guarda LangGraph.

Debe reutilizar el análisis existente salvo que:

```text
repository cambió significativamente
OR
analysis expired
OR
force analysis
```

Esto es crítico para costos.

---

# 22. EMBEDDINGS

No utilizar embeddings locales.

Generarlos mediante API.

Guardar:

```text
pgvector
```

Utilizar inicialmente una única representación semántica construida a partir de:

```text
name
description
AI summary
purpose
use cases
categories
tags
topics
```

No vectorizar repositorio completo en MVP.

---

# 23. HYBRID SEARCH

Implementar búsqueda híbrida usando:

```text
PostgreSQL Full Text Search
+
pgvector cosine similarity
```

Fusionar resultados.

Preferentemente:

```text
Reciprocal Rank Fusion
```

Arquitectura conceptual:

```text
Query
 ├── lexical search
 └── semantic embedding search
          ↓
        RRF
          ↓
      filters
          ↓
      ranking
```

No introducir:

```text
Elasticsearch
OpenSearch
Pinecone
Weaviate
Qdrant
```

en MVP.

---

# 24. BÚSQUEDA NATURAL

El usuario podrá preguntar:

```text
herramienta para diseño agéntico
```

o:

```text
edición open source de audio
```

o:

```text
framework multiagente compatible con Python
```

o:

```text
editor de imágenes self hosted
```

El sistema debe recuperar los repositorios relevantes aunque las palabras exactas no aparezcan.

---

# 25. FILTROS

MVP debe permitir combinar:

```text
search
category
subcategory
language
license
minimum stars
status
favorite
activity
tags
```

Ejemplo:

```text
Agent Memory
MIT or Apache-2.0
>1000 stars
active
```

---

# 26. SIMILAR REPOSITORIES

Implementar en MVP inicialmente:

### Source A

Repositorios similares guardados por el mismo usuario.

### Source B

Repositorios globales ya conocidos por RepoGitHubMind porque otros usuarios los han guardado.

Calcular principalmente mediante:

```text
embedding similarity
+
categories
+
topics
```

No revelar identidad de usuarios.

---

# 27. GITHUB DISCOVERY

Investigar durante implementación la forma más sencilla y económica de sugerir repositorios externos usando GitHub Search API.

No asumir que existe un endpoint oficial llamado:

```text
similar repositories
```

Cuando no exista información suficientemente confiable:

usar búsquedas GitHub construidas desde:

```text
topics
keywords
language
categories
stars
```

Por TIME TO MARKET:

la recomendación de repositorios nuevos externos puede trasladarse a:

```text
R2
```

si complica significativamente MVP.

Prioridad:

```text
MVP = similares dentro del corpus RepoGitHubMind.
```

---

# 28. REFRESH

Cada Repository deberá tener:

```text
metadataRefreshedAt
```

Agregar acción individual:

```text
Refresh
```

y global para usuario:

```text
Update All
```

IMPORTANTE:

`Update All` NO deberá disparar simultáneamente cientos de requests.

Debe utilizar una cola.

Estados:

```text
QUEUED
PROCESSING
COMPLETED
FAILED
```

Implementar rate limiting y backoff.

---

# 29. ASYNC JOBS

Para MVP utilizar la solución más simple compatible con:

```text
PostgreSQL
Node
Docker
```

Evitar agregar Redis si no es realmente necesario.

Evaluar:

```text
pg-boss
```

o una implementación PostgreSQL job queue equivalente.

Preferred:

```text
PostgreSQL-backed jobs
```

Esto mantiene infraestructura mínima.

Jobs:

```text
IMPORT_REPOSITORY
REFRESH_REPOSITORY
ANALYZE_REPOSITORY
GENERATE_EMBEDDING
BULK_IMPORT
UPDATE_ALL
```

---

# 30. IDEMPOTENCIA

Todos los jobs deberán poder repetirse de forma segura.

La URL:

```text
https://github.com/owner/repo
```

debe normalizarse.

Variantes:

```text
github.com/owner/repo
github.com/owner/repo/
github.com/owner/repo.git
https://github.com/owner/repo?x=y
```

deben terminar en la misma Repository.

Preferir GitHub repository ID como identificador externo estable.

---

# 31. UX PRINCIPAL

Crear navegación sencilla:

```text
Home
Explore
My Library
Categories
Import
Favorites
Settings
```

Mobile:

Bottom navigation si mejora experiencia.

Desktop:

Sidebar.

---

# 32. HOME

Mostrar:

```text
Search bar
Recently saved
Favorites
Recently updated
Suggested
Categories
```

El buscador debe ser protagonista.

Ejemplo placeholder:

```text
¿Qué tipo de herramienta necesitas?
```

---

# 33. MY LIBRARY

Debe soportar:

```text
Grid
List
Filters
Sort
Search
```

Sort:

```text
Recently saved
Recently updated
Most starred
Name
Rating
```

---

# 34. EXPLORE

Aquí aparecerán:

- repositorios públicos conocidos por RepoGitHubMind;
- repositorios similares;
- recomendaciones.

Un repositorio puede estar en Explore sin estar en `My Library`.

Botón:

```text
+ Save
```

lo agrega al usuario.

---

# 35. REPOSITORY DETAIL

Diseñar página:

```text
Repository Header
Repository Summary
Why / What it does
Use Cases
Tech
Installation
Metrics
Activity
License
Personal status
Personal notes
Tags
Similar repositories
```

Mantener información compacta.

No generar páginas interminables.

---

# 36. MÉTRICAS DERIVADAS

Puede existir:

```text
Activity Score
Maturity Score
Community Score
```

pero NO dedicar tiempo excesivo al algoritmo MVP.

Preferir heurísticas simples transparentes.

Ejemplo Activity:

```text
lastPush
lastRelease
archived
```

Maturity:

```text
stars
age
releases
license
README
```

Nunca mostrar una precisión falsa.

---

# 37. ABANDONMENT RISK

Categorías simples:

```text
LOW
MEDIUM
HIGH
UNKNOWN
```

Basadas principalmente en actividad.

No presentar esta clasificación como hecho.

Mostrar:

```text
AI / heuristic assessment
```

---

# 38. MODELO DE DATOS PROPUESTO

Diseñar inicialmente entidades similares a:

```text
User
Account
Session

Repository
RepositoryAnalysis
RepositorySnapshot
RepositoryEmbedding

UserRepository

Category
RepositoryCategory

Tag
RepositoryTag

UserTag
UserRepositoryTag

Collection
CollectionRepository

ImportJob
ImportItem

BackgroundJob

AIUsage
```

No crear tablas innecesarias.

---

# 39. RepositorySnapshot

Guardar snapshots livianos para poder saber cambios.

Ejemplo:

```text
repositoryId
stars
forks
issues
updatedAt
pushedAt
latestRelease
capturedAt
```

No crear snapshot con cada request.

Crear solamente durante refresh significativo o una periodicidad razonable.

---

# 40. AIUsage

Registrar:

```text
provider
model
operation
inputTokens
outputTokens
estimatedCost
repositoryId
createdAt
success
```

Esto es importante para controlar costos.

---

# 41. SEGURIDAD

Implementar mínimo:

```text
secure cookies
CSRF protections
server-side authorization
input validation
rate limiting
safe file uploads
SSRF protections
SQL injection protections
XSS protections
security headers
secrets only server-side
```

Todas las queries `UserRepository` deberán comprobar owner.

Nunca confiar en:

```text
userId
```

proporcionado por frontend.

Obtener usuario desde sesión.

---

# 42. IMPORT SECURITY

Archivos permitidos MVP:

```text
.txt
```

Configurar:

- límite razonable;
- MIME validation;
- size validation;
- procesamiento seguro.

No ejecutar contenido.

No renderizar HTML procedente del archivo.

---

# 43. README SECURITY

GitHub README puede incluir contenido no confiable.

Sanitizar cualquier HTML.

Preferir rendering Markdown seguro.

No ejecutar:

```text
script
iframe
unsafe HTML
```

---

# 44. ARQUITECTURA OBJETIVO MVP

Usar arquitectura modular monolith:

```text
Browser / PWA
       │
       ▼
Next.js
 ├── UI
 ├── Auth
 ├── Repository Module
 ├── Library Module
 ├── Import Module
 ├── Search Module
 ├── Recommendation Module
 ├── AI Module
 ├── GitHub Module
 └── Jobs Module
       │
       ▼
PostgreSQL + pgvector
```

Background worker:

```text
Worker
 ├── GitHub Fetch
 ├── AI Analysis
 ├── Embeddings
 └── Refresh
```

Puede vivir en el mismo monorepo.

NO microservicios.

---

# 45. MONOREPO

Utilizar estructura pragmática.

Ejemplo:

```text
repogithubmind/

apps/
  web/
  worker/

packages/
  db/
  github/
  ai/
  search/
  shared/
  config/

docs/

docker/
```

Si TurboRepo agrega complejidad innecesaria durante MVP, utilizar workspace simple con:

```text
pnpm workspaces
```

Preferred package manager:

```text
pnpm
```

---

# 46. DOCKER

Desarrollo deberá poder levantarse con:

```bash
docker compose up -d
```

Contenedores mínimos:

```text
postgres
web
worker
```

Durante desarrollo web/worker pueden ejecutarse directamente fuera de Docker si mejora DX.

---

# 47. DESPLIEGUE R1

Primera etapa:

```text
localhost
+
Cloudflare Tunnel
```

Crear documentación para exponer ambiente de pruebas usando Cloudflare Tunnel sin abrir puertos directamente.

Posteriormente:

```text
Hostinger VPS
```

---

# 48. HOSTINGER TARGET

Preparar producción para un VPS convencional mediante:

```text
Ubuntu
Docker
Docker Compose
Cloudflare
PostgreSQL
automatic backups
```

Opcional posteriormente:

```text
Dokploy
```

No hacer arquitectura dependiente de Vercel.

---

# 49. CLOUDFLARE

Preparar para:

```text
DNS
HTTPS
Tunnel inicialmente
reverse proxy/CDN posteriormente
basic security/rate controls
```

No hacer Cloudflare Workers requisito para funcionamiento.

---

# 50. OBSERVABILITY

MVP:

```text
structured logs
request IDs
job logs
AI usage
GitHub errors
```

Evitar infraestructura de observabilidad pesada.

Posteriormente evaluar OpenTelemetry.

---

# 51. TESTING

Implementar:

```text
unit tests
integration tests
E2E
```

Herramientas recomendadas:

```text
Vitest
Playwright
```

Especialmente pruebas sobre:

```text
URL normalization
import parser
authorization
repository deduplication
search
AI structured response validation
Update All
```

---

# 52. VALIDACIÓN

Usar:

```text
Zod
```

para:

- forms;
- APIs;
- AI structured outputs;
- env vars.

---

# 53. OFFLINE

Utilizar IndexedDB cuando sea necesario para:

```text
cached repositories
offline pending actions
```

No duplicar base completa.

Guardar solamente lo necesario.

Al reconectar:

```text
local queue
   ↓
sync
   ↓
server
```

Resolver conflictos simple:

para status/rating/note inicialmente:

```text
last-write-wins
```

registrando `updatedAt`.

---

# 54. MVP-R1 — ALCANCE EXACTO

MVP-R1 DEBE incluir:

### Accounts

- register
- login
- logout
- session
- user settings

### Repository ingestion

- paste GitHub URL
- paste arbitrary text
- upload TXT
- extract URLs
- preview
- import
- deduplication

### GitHub

- public repositories only
- metadata
- README
- topics
- languages
- license
- releases
- stars
- forks
- activity dates

### AI

- summary
- purpose
- use cases
- categories
- tags
- installation summary
- maturity brief
- advantages
- limitations
- activity/abandonment assessment
- embeddings

### Personal

- status
- favorite
- rating
- notes
- user tags
- collections

### Search

- text search
- semantic search
- hybrid search
- filters

### Discovery

- similar from My Library
- similar from global RepoGitHubMind corpus

### Maintenance

- Refresh repository
- Update All
- queued jobs

### PWA

- installable
- responsive
- offline shell
- cached repo viewing
- offline personal changes/sync

### Deployment

- localhost
- Docker
- Cloudflare Tunnel
- Hostinger-ready

---

# 55. R2 — DISCOVERY

NO implementar hasta terminar MVP-R1.

Planificar:

```text
GitHub OAuth
Import GitHub Stars
External GitHub recommendations
GitHub Search discovery
smart collections
automatic periodic refresh
trending repositories
advanced recommendation ranking
PWA share integrations where supported
```

---

# 56. R3 — DEEP REPOSITORY INTELLIGENCE

Planificar:

```text
selective clone
repository tree analysis
package manifests
dependencies
architecture detection
framework detection
Docker analysis
CI/CD analysis
security indicators
documentation quality
installation validation
code language breakdown
repo health
```

NO clonar repositorios MVP.

---

# 57. R4 — KNOWLEDGE GRAPH

Evolución:

```text
repository relationships
alternatives
depends-on
similar-to
integrates-with
replaces
complements
```

Permitir consultas:

```text
¿Qué alternativas tengo a LangGraph?
```

```text
¿Qué herramientas tengo de agent memory?
```

```text
¿Cuáles funcionan con Claude Code?
```

---

# 58. R5 — TEAMS / ENTERPRISE

Posteriormente:

```text
organizations
shared libraries
teams
shared collections
comments
admin policies
SSO
API
MCP Server
webhooks
GALIX integration
```

---

# 59. LICENCIA DEL PROYECTO

RepoGitHubMind deberá publicarse inicialmente bajo:

```text
Apache License 2.0
```

Crear:

```text
LICENSE
NOTICE
```

NOTICE deberá indicar apropiadamente:

```text
RepoGitHubMind
Copyright 2026 2BCORE
```

Usar:

```text
SPDX-License-Identifier: Apache-2.0
```

cuando corresponda.

IMPORTANTE:

No afirmar en documentación que Apache-2.0 impide comercialización.

Apache-2.0 permite uso comercial.

La autoría/copyright deberá mantenerse correctamente.

No inventar restricciones incompatibles con Apache-2.0.

La marca:

```text
RepoGitHubMind
2BCORE
```

puede tratarse separadamente del copyright/software.

Agregar sección en documentación:

```text
Trademark and Branding
```

indicando que nombres/logos de 2BCORE no se transfieren automáticamente mediante la licencia del código, sujeto a revisión jurídica posterior.

---

# 60. REPOSITORIO PRINCIPAL

El desarrollo real de RepoGitHubMind debe existir primero en un repositorio propiedad del autor/2BCORE.

Ejemplo conceptual:

```text
rene/RepoGitHubMind
```

o

```text
2bcore/RepoGitHubMind
```

Preferentemente:

```text
2BCORE/RepoGitHubMind
```

si la organización está disponible.

Este debe ser considerado:

> SOURCE OF TRUTH.

---

# 61. PROYECTO ACADÉMICO AI4Devs

Existe adicionalmente este requerimiento académico:

Repositorio oficial:

```text
https://github.com/LIDR-academy/AI4Devs-finalproject
```

Se requiere hacer:

```text
fork
```

del repositorio oficial.

Las entregas usan ramas:

```text
feature/entrega-1-RLL
feature/entrega-2-RLL
final-project-RLL
```

Usaremos provisionalmente las iniciales:

```text
RLL
```

para René López López.

---

# 62. ESTRATEGIA DE REPOSITORIOS

NO desarrollar el producto únicamente dentro del fork académico.

Arquitectura de repos:

```text
2BCORE/RepoGitHubMind
        │
        │ source of truth
        │
        └────────────► integración académica
                         │
                         ▼
LIDR-academy/AI4Devs-finalproject
             ↓
           FORK
             ↓
feature/entrega-1-RLL
feature/entrega-2-RLL
final-project-RLL
```

La intención es:

1. mantener RepoGitHubMind como proyecto independiente;
2. conservar propiedad/autoria 2BCORE;
3. poder continuar el desarrollo después del curso;
4. utilizar el fork académico únicamente para realizar las entregas solicitadas.

---

# 63. NO MODIFICAR HISTORIA SIN NECESIDAD

Antes de ejecutar acciones Git:

1. inspeccionar repositorio actual;
2. identificar remotes;
3. identificar branch;
4. identificar estructura requerida por proyecto académico.

Nunca:

```text
force push
```

sin autorización explícita.

Nunca borrar branches.

Nunca modificar upstream.

---

# 64. DOCUMENTACIÓN

Crear:

```text
README.md
CONTRIBUTING.md
LICENSE
NOTICE
SECURITY.md
CODE_OF_CONDUCT.md
CHANGELOG.md
```

Y:

```text
docs/
  architecture.md
  data-model.md
  taxonomy.md
  ai-architecture.md
  deployment-local.md
  deployment-hostinger.md
  roadmap.md
  ADR/
```

---

# 65. ADRs

Crear Architecture Decision Records únicamente para decisiones importantes.

Inicialmente:

```text
ADR-001 modular-monolith
ADR-002 postgres-pgvector
ADR-003 global-repository-userrepository
ADR-004-ai-provider-abstraction
ADR-005-postgres-job-queue
ADR-006-apache-license
```

Mantenerlos breves.

---

# 66. UI STYLE

Diseño:

```text
modern
minimal
clean
developer-oriented
information dense
fast
```

Inspiraciones conceptuales:

```text
GitHub
Linear
Raycast
Vercel
Arc
```

NO copiar diseños.

Debe soportar:

```text
dark mode
light mode
system
```

---

# 67. MOBILE

El producto deberá diseñarse desde mobile, no adaptar desktop al final.

Priorizar:

```text
Search
Save repo
Library
Repository detail
Status
Favorite
```

Buttons touch-friendly.

---

# 68. PERFORMANCE

Objetivos:

- evitar N+1;
- pagination;
- lazy loading;
- indexes;
- caching;
- background AI;
- optimistic UI cuando corresponda.

No bloquear:

```text
Save Repository
```

esperando 30 segundos al análisis AI.

Flujo:

```text
SAVE
 ↓
metadata
 ↓
repository visible
 ↓
AI ANALYZING...
 ↓
analysis appears
```

---

# 69. DATABASE INDEXES

Analizar índices para:

```text
githubRepositoryId
fullName
userId + repositoryId
status
favorite
category
createdAt
pushedAt
fts
embedding
```

Usar índice pgvector apropiado solamente cuando volumen lo justifique.

No optimizar prematuramente.

---

# 70. SEARCH UX

La búsqueda debe devolver algo del tipo:

```text
Search:
"memoria para agentes"

Results

1. Hindsight
   Agent Memory
   ⭐ ...
   MIT
   Active

   Why:
   Memoria de largo plazo diseñada para agentes...

2. Mem0
   ...

3. Letta
   ...
```

La explicación debe ser corta.

---

# 71. SEARCH PRIVACY

Global search puede buscar:

```text
Repository
```

My Library search:

```text
Repository + UserRepository
```

Nunca incluir notas de otros usuarios.

---

# 72. DUPLICADOS

Si usuario intenta guardar repo existente:

mostrar:

```text
Already in your library
```

No crear registro duplicado.

Si global Repository existe pero usuario no lo tiene:

crear solamente:

```text
UserRepository
```

---

# 73. DELETED / RENAMED REPOSITORIES

Durante Refresh:

detectar:

```text
404
redirect
rename
archive
```

No borrar automáticamente.

Marcar estados apropiados.

---

# 74. UPDATE ALL

UX:

```text
Update All
```

Mostrar:

```text
Updating 486 repositories

Completed 127
Queued 331
Failed 2
```

Debe poder cerrarse pantalla sin cancelar jobs.

---

# 75. RATE LIMITS

Implementar respeto a GitHub API rate limits.

Capturar headers correspondientes.

Hacer:

```text
retry
backoff
queue throttling
```

No lanzar cientos de requests simultáneamente.

---

# 76. AI FAILURE

Si falla AI:

Repository sigue siendo utilizable.

Mostrar:

```text
Analysis unavailable
Retry
```

Nunca impedir guardar repositorio por falla de AI.

---

# 77. COST CONTROL

AI debe ser opcional configurable.

Crear:

```env
AI_ANALYSIS_ENABLED=true
```

Y límites:

```text
max README characters
max tokens
analysis TTL
```

No mandar README gigante completo.

Aplicar truncation inteligente.

---

# 78. ADMIN

Crear role mínimo:

```text
USER
ADMIN
```

ADMIN podrá:

```text
manage taxonomy
inspect failed jobs
inspect AI usage
```

No construir panel administrativo complejo MVP.

---

# 79. API

Aunque frontend use Server Actions, diseñar dominio desacoplado.

No meter lógica de negocio dentro de componentes React.

Estructura conceptual:

```text
UI
 ↓
Application Services
 ↓
Domain
 ↓
Infrastructure
```

Sin caer en Clean Architecture ceremonial excesiva.

---

# 80. CODING RULES

Usar:

```text
TypeScript strict
ESLint
Prettier
Zod
typed DB queries
```

No utilizar:

```text
any
```

salvo justificación.

---

# 81. ERROR HANDLING

Crear errores tipados:

```text
RepositoryNotFoundError
InvalidGitHubUrlError
GitHubRateLimitError
AIProviderError
AuthorizationError
```

UI debe mostrar errores humanos.

---

# 82. DATABASE MIGRATIONS

Todas las modificaciones mediante migrations.

Nunca depender de:

```text
manual SQL production changes
```

---

# 83. SEED DATA

Crear seeds para:

```text
taxonomy
demo repositories
development user
```

Nunca usar passwords reales.

---

# 84. ENV

Crear:

```text
.env.example
```

Nunca incluir secrets.

---

# 85. BACKUPS

Para Hostinger documentar:

```text
daily PostgreSQL backups
retention
restore procedure
```

El backup es obligatorio antes de considerar producción real.

---

# 86. GITHUB ACTIONS

Crear CI sencilla:

```text
install
lint
typecheck
test
build
```

Posteriormente:

```text
Playwright
Docker build
```

Evitar pipelines excesivamente complejos.

---

# 87. DEFINITION OF DONE MVP-R1

MVP estará terminado solamente cuando un usuario nuevo pueda:

1. crear cuenta;
2. iniciar sesión;
3. pegar URL GitHub;
4. verla guardada;
5. observar metadata;
6. observar estrellas;
7. observar licencia;
8. observar última actividad;
9. recibir resumen AI;
10. recibir categorías;
11. cambiar estado;
12. marcar favorito;
13. poner rating;
14. agregar nota;
15. importar `.txt`;
16. importar cientos de URLs;
17. buscar repositorios;
18. usar búsqueda semántica;
19. filtrar resultados;
20. abrir repositorios similares;
21. descubrir repositorios del corpus global;
22. actualizar un repositorio;
23. ejecutar Update All;
24. instalar PWA;
25. visualizar repositorios cacheados offline;
26. operar correctamente desde iPhone;
27. operar correctamente desde Android;
28. levantar entorno mediante documentación;
29. ejecutar tests;
30. desplegar posteriormente en Hostinger sin rediseñar arquitectura.

---

# 88. FUERA DE ALCANCE MVP

NO implementar:

```text
private GitHub repositories
GitLab
Bitbucket
full repository cloning
AST analysis
GraphRAG
knowledge graph
local LLM
local embedding models
direct WhatsApp API
browser extension
native iOS app
native Android app
Kubernetes
microservices
Kafka
Elasticsearch
external vector database
enterprise SSO
team collaboration
```

---

# 89. IMPLEMENTATION STRATEGY

No intentes construir todo simultáneamente.

Trabaja verticalmente.

Orden recomendado:

### Phase 0

Repository audit + bootstrap.

### Phase 1

Auth + database.

### Phase 2

Repository ingestion.

### Phase 3

GitHub metadata.

### Phase 4

My Library.

### Phase 5

AI analysis.

### Phase 6

Taxonomy.

### Phase 7

Search.

### Phase 8

Similar repositories.

### Phase 9

Bulk TXT import.

### Phase 10

Jobs + Update All.

### Phase 11

PWA/offline.

### Phase 12

Polish/testing/security.

### Phase 13

Docker + Cloudflare documentation.

---

# 90. IMPORTANTE: TRABAJA AUTÓNOMAMENTE

Antes de preguntarme algo:

1. revisa este documento;
2. revisa el código existente;
3. revisa README;
4. revisa package.json;
5. revisa Git history;
6. revisa decisiones existentes.

Si puedes tomar una decisión segura utilizando estándares modernos, tómala.

No interrumpas continuamente para preguntar decisiones triviales.

Documenta las decisiones importantes.

---

# 91. NO SOBREDISEÑAR

Ante dos soluciones técnicamente correctas:

elige la que tenga:

```text
menos infraestructura
menos dependencia
menor costo
menor mantenimiento
mejor DX
```

siempre que no comprometa la arquitectura fundamental.

---

# 92. COSTO COMO REQUERIMIENTO

El producto debe poder ejecutarse inicialmente con costos muy bajos.

Objetivo:

```text
Development:
≈ $0 adicional aparte de APIs consumidas.

Production inicial:
1 VPS económico Hostinger
+
AI/API usage
+
domain opcional
```

PostgreSQL y pgvector deberán convivir en el mismo VPS inicialmente.

---

# 93. EVOLUCIÓN

La arquitectura debe permitir eventualmente:

```text
10 repos
100 repos
1,000 repos
10,000 repos
100,000 repos
```

sin asumir desde MVP que ya tenemos el volumen máximo.

Optimizar cuando métricas reales lo requieran.

---

# 94. PRODUCT PHILOSOPHY

RepoGitHubMind debe lograr que una persona que haya guardado 2,000 repositorios pueda preguntar:

```text
"Necesito una herramienta para memoria compartida
entre agentes que pueda integrar con Claude Code."
```

y recuperar inmediatamente:

- lo que ya conoce;
- lo que guardó;
- alternativas;
- repositorios parecidos;
- cuáles continúan activos;
- cuáles tienen licencia apropiada;
- cuáles parecen más maduros.

Ese es el verdadero producto.

---

# 95. PRIMERA TAREA PARA CLAUDE CODE

Ahora comienza.

NO intentes implementar todo antes de inspeccionar el entorno.

Ejecuta primero:

```text
1. Inspect repository.
2. Inspect git status.
3. Inspect remotes.
4. Inspect branches.
5. Inspect existing files.
6. Identify whether this is:
   a) RepoGitHubMind source repository
   b) AI4Devs academic fork
7. Do not destroy existing work.
```

Después crea:

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/DATA_MODEL.md
docs/TAXONOMY.md
```

concisos y derivados de este prompt.

Después genera el backlog MVP-R1.

Después implementa Phase 0 y Phase 1.

Continúa iterativamente hasta conseguir MVP-R1, validando cada vertical slice con tests antes de avanzar.

---

# 96. REGLA FINAL

Cuando encuentres tensión entre:

```text
perfección arquitectónica
```

y:

```text
liberar un MVP funcional rápidamente
```

elige la segunda siempre que:

- no comprometa seguridad;
- no comprometa privacidad;
- no provoque una reescritura estructural obvia.

El objetivo es:

> **RepoGitHubMind MVP-R1 funcional, pequeño, económico, mantenible y liberable lo antes posible.**