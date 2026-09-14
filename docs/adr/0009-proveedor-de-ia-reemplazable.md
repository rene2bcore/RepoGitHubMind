# ADR-0009 · Proveedor de IA reemplazable y análisis cacheado por repositorio

## Estado

Aceptada · 2026-09-14

## Contexto

La IA es lo más caro y lo más volátil del producto: los proveedores cambian precios y modelos cada pocos meses, y un análisis por repositorio y por usuario multiplicaría el coste por el número de cuentas. El maestro exige que la IA sea reemplazable (§2.8, §18), económica (§17, §77), cacheada (§21), opcional (§76) y nunca local (§2.14).

## Decisión

**Una interfaz `AIProvider` con dos operaciones, `analyzeRepository` y `createEmbedding`, un `AIProviderRegistry` que elige la implementación por `AI_PROVIDER` y `AI_EMBEDDING_PROVIDER`, y ningún nombre de modelo en el código.** El análisis se hace una vez por `Repository` global y se reutiliza salvo cambio del repositorio, caducidad (`AI_ANALYSIS_TTL_DAYS`) o forzado. La salida es JSON validado con Zod, acotado (resumen de 200 caracteres, 5 casos de uso, 3 ventajas, 3 limitaciones). Todo uso se registra en `ai_usage` con coste estimado. Con `AI_ANALYSIS_ENABLED=false` no hay llamadas, y el producto funciona sin resumen y con búsqueda solo léxica.

Primera implementación: OpenRouter, porque una clave da acceso a varios modelos y facilita medir coste (`PA-2`). Detalle en [`../ai-architecture.md`](../ai-architecture.md).

## Alternativas consideradas

**SDK de un proveedor directamente.** Más simple hoy, y acopla el producto al proveedor que cambie de precio mañana.

**Un análisis por usuario, personalizado.** Multiplica el coste sin cambiar ninguna de las decisiones del PRD §3.

**IA local con Ollama.** Prohibido por el maestro y fuera del presupuesto de un VPS económico.

## Consecuencias

Cambiar de proveedor es una variable de entorno. Cambiar el modelo de embeddings obliga a revectorizar todo y a migrar la dimensión del vector: se decide una vez (`PA-3`). Un proveedor caído no rompe el producto, solo aplaza el resumen.

## Cómo se comprobó

Pendiente de la Entrega final (RGM-5): pruebas unitarias del registro con un proveedor falso, del cacheo (segunda cuenta no genera fila en `ai_usage`) y de la validación de salida (un `summary` de 400 caracteres se rechaza). La mutación del catálogo cambia la condición del caché para que analice siempre y exige que la prueba caiga.
