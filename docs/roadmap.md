# Roadmap

> MVP-R1 entero es el objetivo del producto ([prompt maestro](prompts/00-prompt-maestro.md) §54 y §87). La entrega académica construye una **vertical** de MVP-R1 ([`prd.md`](prd.md)). Esta página dice qué queda de MVP-R1 después de la vertical, y qué viene después. Nada de R2 en adelante se implementa antes de terminar MVP-R1 (§55).

## MVP-R1: la vertical académica y lo que queda

Las fases son las del §89 del maestro. Las historias, las de `docs/backlog/`.

| Fase del maestro | Qué | Entrega académica | Historia |
|---|---|---|---|
| 0 | Auditoría y bootstrap del repositorio con el harness | **Entrega 1** (hecha) | - |
| 1 | Auth y base de datos | Entrega 2 | H1 · RGM-2 |
| 2 | Ingesta por URL | Entrega 2 | H2 · RGM-3 |
| 3 | Metadata de GitHub | Entrega 2 | H2 · RGM-3 |
| 4 | Mi biblioteca | Entrega 2 | H3 · RGM-4 |
| 5 | Análisis de IA | Entrega final | H4 · RGM-5 |
| 6 | Taxonomía | Entrega final (como seed y mapeo) | H4 · RGM-5 |
| 7 | Búsqueda | Entrega final | H5 · RGM-6 |
| 8 | Repositorios similares | Entrega final si cabe (`PA-5`) | S2 · RGM-8 |
| 9 | Importación masiva `.txt` | Entrega final si cabe (`PA-5`) | S1 · RGM-7 |
| 10 | Cola y Update All | Después del curso | - |
| 11 | PWA y offline | Después del curso | - |
| 12 | Pulido, pruebas, seguridad | Continuo | - |
| 13 | Docker y documentación de Cloudflare | Entrega final (Docker) y después (Hostinger) | - |

### Lo que MVP-R1 exige y la vertical deja fuera

- **Refresh individual y Update All** con cola visible, estados `QUEUED / PROCESSING / COMPLETED / FAILED`, rate limiting y backoff; snapshots livianos; detección de renombrados, archivados y borrados (§28, §39, §73, §74).
- **PWA**: manifest, iconos, instalable en iOS y Android, shell offline, caché de repositorios, cola de acciones pendientes con sincronización last-write-wins (§8, §53).
- **Explore**: navegar el corpus global sin buscar, con «+ Guardar» (§34).
- **Colecciones y tags personales** (§3, §54 Personal).
- **Rol ADMIN**: gestionar la taxonomía, ver trabajos fallidos y uso de IA (§78).
- **Fallback de proveedor de IA** configurado (§20).
- **Despliegue en Hostinger** con backups diarios (§47, §48, §85).

La Definition of Done de MVP-R1 son los 30 puntos del §87. La vertical cubre los puntos 1 a 14 y 17 a 21, más el 28 y el 29; los demás quedan aquí.

## R2 · Descubrimiento

GitHub OAuth y Google; importar las estrellas de GitHub; recomendaciones externas y descubrimiento con GitHub Search construido desde topics, palabras clave, lenguaje y categorías (no existe un endpoint oficial de «similares», §27); colecciones inteligentes; refresh periódico automático; repositorios en tendencia; ranking avanzado de recomendaciones; Share Target de la PWA donde el sistema lo permita (§55).

## R3 · Inteligencia profunda del repositorio

Clonado selectivo, análisis del árbol, manifiestos de paquetes, dependencias, detección de arquitectura y frameworks, Docker, CI/CD, indicadores de seguridad, calidad de la documentación, validación de instalación, desglose de lenguajes, salud del repositorio (§56). Nada de esto en MVP-R1: no se clona.

## R4 · Grafo de conocimiento

Relaciones entre repositorios: alternativas, depende de, similar a, se integra con, reemplaza, complementa. Consultas como «¿qué alternativas tengo a LangGraph?» y «¿cuáles funcionan con Claude Code?» (§57).

## R5 · Equipos y empresa

Organizaciones, bibliotecas y colecciones compartidas, comentarios, políticas de administración, SSO, API pública, servidor MCP, webhooks (§58).

## La filosofía que ordena todo esto

Que una persona con dos mil repositorios guardados pueda preguntar «necesito una herramienta para memoria compartida entre agentes que pueda integrar con Claude Code» y recuperar al momento lo que ya conoce, lo que guardó, alternativas, parecidos, cuáles siguen activos, cuáles tienen licencia apropiada y cuáles parecen más maduros (§94). Cada fase se mide contra eso.
