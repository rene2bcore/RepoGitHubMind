# ADR-0006 · Monolito modular en Next.js con un worker aparte

## Estado

Aceptada · 2026-09-14

## Contexto

El prompt maestro fija dos cosas que tiran en direcciones opuestas: un producto que pueda evolucionar a miles de usuarios y cientos de miles de repositorios (§0), y «Time to Market > sobrearquitectura» con costes mínimos (§2, §92). Y fija además que el análisis de IA tarda decenas de segundos y guardar un repositorio no puede esperar (§68).

## Decisión

**Monolito modular**: una aplicación Next.js (`apps/web`) con módulos de dominio separados (Auth, Repository, Library, Import, Search, Recommendation, AI, GitHub, Jobs), **un worker aparte** (`apps/worker`) que consume una cola en PostgreSQL, y paquetes compartidos en `packages/`. Dentro de la aplicación, `UI → servicios de aplicación → dominio → infraestructura`, sin lógica de negocio en componentes React ni en Route Handlers (§79), y sin la ceremonia de una Clean Architecture completa. pnpm workspaces sin Turborepo (§45).

El worker es un proceso porque el trabajo largo no cabe en una petición HTTP. Es un solo proceso, no un servicio: comparte base, esquema y despliegue con la web.

## Alternativas consideradas

**Microservicios desde el principio.** Prohibido por el maestro (§2.11, §88) y sin volumen que lo justifique.

**Todo dentro de Next.js, con la IA en la propia petición.** Bloquea guardar durante decenas de segundos y agota los tiempos de los Route Handlers.

**Un backend independiente (Fastify, Nest).** El maestro lo reserva para «necesidad real» (§9). No la hay: Route Handlers y Server Actions cubren la vertical.

## Consecuencias

Una sola cosa que desplegar y respaldar, un solo `docker compose`, un VPS. La web y el worker se despliegan juntos porque comparten esquema. Un módulo que crezca puede convertirse en servicio sin reescribir los demás, y esa es la única concesión al futuro que se paga hoy: mantener los módulos separados de verdad, sin importaciones cruzadas entre dominios.

## Cómo se comprobó

No es una decisión con comprobación mecánica: es una forma. Lo que sí se vigilará desde la Entrega 2 es que ningún componente React importe `packages/db` directamente, con una regla de ESLint de importaciones restringidas y su entrada en el catálogo de mutaciones.
