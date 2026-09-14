# ADR-0010 · Cola de trabajos en PostgreSQL, sin Redis

## Estado

Aceptada · 2026-09-14

## Contexto

Guardar un repositorio encadena trabajo que no cabe en una petición: pedir metadata a GitHub respetando su rate limit, analizar con IA, generar el embedding. Y la importación masiva encola cientos de repositorios de golpe, que no pueden convertirse en cientos de peticiones simultáneas a GitHub (§28, §75). Hace falta una cola con estados, reintentos y backoff. Lo habitual es Redis con BullMQ; el maestro pide evitar Redis si no es realmente necesario (§29).

## Decisión

**La cola vive en PostgreSQL.** Se evalúa `pg-boss` como primera opción; si añade más de lo que resuelve, una tabla `background_jobs` propia con `status`, `run_after`, `attempts` y `last_error`, tomada con `SELECT … FOR UPDATE SKIP LOCKED`. Trabajos: `IMPORT_REPOSITORY`, `REFRESH_REPOSITORY`, `ANALYZE_REPOSITORY`, `GENERATE_EMBEDDING`, `BULK_IMPORT`. **Todos idempotentes**: repetir un trabajo produce el mismo estado, porque la URL se normaliza y el id de GitHub es la clave (§30). Reintentos con backoff exponencial; concurrencia limitada por tipo de trabajo para respetar a GitHub y al proveedor de IA.

## Alternativas consideradas

**Redis + BullMQ.** Mejor herramienta para colas de alto volumen; una pieza más que operar, respaldar y pagar, para un volumen que no la necesita.

**Ejecutar en la propia petición con `waitUntil`.** No sobrevive a un reinicio ni permite reintentos.

**Cron sin cola.** No da estados ni progreso, y la importación masiva los necesita.

## Consecuencias

El worker y la web comparten la base y el `pg_dump` diario incluye la cola. La cola compite por conexiones con la aplicación; con un VPS y pocos usuarios no importa, y es lo primero que se mide si importa. La decisión entre `pg-boss` y tabla propia se toma en RGM-3 y se anota aquí con fecha.

## Cómo se comprobó

Pendiente de la Entrega 2 (RGM-3): una prueba de integración que encole el mismo repositorio dos veces y compruebe una sola `Repository` y un solo trabajo efectivo; y otra que simule un `429` de GitHub y compruebe el reintento con `run_after` en el futuro.
