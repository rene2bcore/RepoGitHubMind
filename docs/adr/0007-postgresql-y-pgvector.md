# ADR-0007 · PostgreSQL + pgvector como única infraestructura de datos

## Estado

Aceptada · 2026-09-14

## Contexto

El producto necesita cuatro cosas de datos: relacional (cuentas, repositorios, relaciones privadas), búsqueda de texto completo, búsqueda vectorial para la semántica, y una cola de trabajos. Lo habitual es una pieza por necesidad: PostgreSQL, Elasticsearch, una vector DB y Redis. El maestro lo prohíbe expresamente (§2.10 a §2.13, §23, §88) y fija un VPS económico como objetivo (§92).

## Decisión

**PostgreSQL 16 con la extensión pgvector resuelve las cuatro.** `tsvector` con índice GIN para lo léxico, `vector` con similitud de coseno para lo semántico, Reciprocal Rank Fusion en SQL para fusionarlas, y una cola sobre tablas ([ADR-0010](0010-cola-de-trabajos-en-postgresql.md)). Drizzle como ORM (§9), con migraciones para todo cambio de esquema (§82).

El índice HNSW sobre el embedding **no se crea hasta que el volumen lo justifique** (§69): con cientos o pocos miles de repositorios el escaneo secuencial responde en milisegundos y el índice solo añade coste de escritura.

## Alternativas consideradas

**Elasticsearch u OpenSearch para la búsqueda.** Mejor relevancia léxica y facetas; una pieza más que operar y respaldar, y prohibida en MVP.

**Pinecone, Weaviate, Qdrant para vectores.** Mejor rendimiento a millones de vectores; el MVP no los tiene, y sería la segunda fuente de verdad de los repositorios.

**Prisma en vez de Drizzle.** El maestro admite Prisma con una razón técnica claramente superior documentada; no la hay. Drizzle genera SQL más transparente y las queries de RRF se escriben mejor a mano.

## Consecuencias

Una sola base que migrar, respaldar y restaurar. Los `pg_dump` diarios cubren todo, incluida la cola. Por encima de cientos de miles de repositorios la búsqueda vectorial en PostgreSQL rendirá peor que una vector DB dedicada; se decide entonces, con métricas reales, y el módulo `search` es el único que cambiaría.

## Cómo se comprobó

Pendiente de la Entrega 2: la migración inicial habilita `vector` en un contenedor limpio, y una prueba de integración ejecuta una búsqueda híbrida con RRF sobre datos sembrados y comprueba el orden esperado.
