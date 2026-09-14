# RGM-5 · H4 · Análisis de IA cacheado por repositorio con proveedor reemplazable

**Identificador:** `RGM-5` · [en Jira](https://ai4devs.atlassian.net/browse/RGM-5)
**Épica:** RGM-1
**Traza:** RF-13 a RF-16 del [PRD](../prd.md) · Prompt maestro §15 a §21, §36, §37, §40, §76, §77
**Prioridad:** must-have · **Entrega:** final · **Spec:** [`specs/ai`](../specs/ai/spec.md) · **Arquitectura:** [`ai-architecture.md`](../ai-architecture.md)

## Historia

> Como persona que guarda muchos repositorios, quiero que cada uno tenga un resumen corto, su propósito, casos de uso, categorías de la taxonomía, tags y una valoración de madurez y actividad, para entender para qué sirve sin abrir su README.

## Criterios de aceptación

### Camino feliz

**CA-1 · El resumen llega después de guardar**
DADO un repositorio recién guardado
CUANDO termina su análisis en segundo plano
ENTONCES aparecen resumen (máximo 200 caracteres), propósito, hasta 5 casos de uso, categorías del catálogo, tags, resumen de instalación, hasta 3 ventajas y 3 limitaciones, madurez y riesgo de abandono etiquetado como valoración.

**CA-2 · Una vez para todos**
DADO un repositorio ya analizado
CUANDO otra cuenta lo guarda
ENTONCES reutiliza el análisis sin llamar a la IA ni registrar coste.

**CA-3 · Cambiar de proveedor sin código**
DADO un cambio de `AI_PROVIDER` o `AI_MODEL_ANALYSIS`
CUANDO arranca el worker
ENTONCES usa el nuevo proveedor y `ai_usage` lo registra.

### Lo que no debe ocurrir

**CA-4 · La IA nunca impide guardar**
DADO que la IA falla o está deshabilitada
CUANDO guardo
ENTONCES el repositorio queda guardado y usable, con «Análisis no disponible · Reintentar».

**CA-5 · Sin categorías inventadas**
DADO una sugerencia que no está en el catálogo
CUANDO se mapea
ENTONCES queda como tag de IA y no aparece ninguna categoría nueva.

**CA-6 · Sin precisión falsa**
DADO el riesgo de abandono
CUANDO se muestra
ENTONCES no hay porcentajes ni decimales, y se etiqueta como heurística.

### Errores y límites

**CA-7 · Salida que no valida**
DADO una respuesta con un resumen de 400 caracteres
CUANDO llega
ENTONCES se reintenta una vez y después queda `FAILED`; nada inválido se guarda.

**CA-8 · Coste registrado**
DADO cualquier análisis
CUANDO termina
ENTONCES hay una fila en `ai_usage` con proveedor, modelo, tokens y coste estimado.

**CA-9 · Se vuelve a analizar solo si cambió** · **[PROPUESTO]**
DADO un repositorio con pushes posteriores al análisis
CUANDO alguien lo guarda o fuerza
ENTONCES se encola un análisis nuevo; si no cambió y no caducó, no.

_Motivo: el maestro §21 dice «cambió significativamente» sin definirlo; se fija en `githubPushedAt` posterior a `aiAnalyzedAt`, que es computable._

_Validado el 2026-09-14 contra `specs/ai` («Repositorio que cambió») y la decisión del autor al arrancar H4._

## Fuera de alcance

- Embeddings y búsqueda semántica (H5), IA local, análisis del código (R3), fallback a segundo proveedor (roadmap).

## Puntos abiertos que bloquean

Ninguno. `PA-2` y `PA-3` cerrados el 2026-09-14 en [`prd.md`](../prd.md) §10: OpenRouter con `google/gemini-2.5-flash-lite` y, para H5, `openai/text-embedding-3-small` de 1536 dimensiones. El coste se midió con una llamada real, no sobre 20 repositorios.

## Tickets

Construida el 2026-09-14 en `feat/RGM-5-analisis-ia`, en un solo PR y un commit por capa.

**Datos.** Migración `0002` con `categories` (jerárquica, con sinónimos), `repository_categories`, `tags`, `repository_tags` y `ai_usage`; el catálogo de `taxonomy.md` en `packages/db/src/taxonomy.ts`, sembrado en todos los entornos y contrastado con el documento por `taxonomia.test.ts`.

**IA.** `packages/ai`: `AIProvider`, `AIProviderRegistry`, `OpenRouterProvider`, `FakeAIProvider`, validación con un reintento, recorte del README, caché, heurística de abandono y mapeo de taxonomía.

**Worker.** `ANALYZE_REPOSITORY` real en `apps/worker/src/analyze.ts`, idempotente, con backoff de la cola, `FAILED` definitivo si la salida no valida dos veces, y `ai_usage` por llamada.

**Backend y frontend.** Guardar pide el análisis solo si hace falta; `POST /api/v1/repositories/{id}/analysis` para reintentar o forzar; filtro `category` por rama; categorías, análisis completo y valoración etiquetada en la tarjeta y el detalle; la lista se relee sola mientras hay un análisis en camino.

**Definition of Done**

- [x] CA-1 a CA-9 con prueba unitaria, de integración o de navegador; CA-9 validado contra la spec y probado
- [x] Ninguna prueba llama a la red ni usa la clave real; una sola llamada manual con la clave, grabada en `packages/ai/tests/fixtures/openrouter-pgvector.json` y contada en el PR
- [x] Mutación `ADR-0009` en el catálogo, vista morder en la prueba de la segunda cuenta y en la unitaria de la caché
- [x] `pnpm openapi:check` en verde con la ruta nueva y el filtro `category`; tabla de `CLAUDE.md` al día
- [x] `docs/capabilities/ai/README.md`; filas en `docs/traceability.md`; `ai-architecture.md` y `data-model.md` al día
- [x] Sin dependencias nuevas del registro de npm: `fetch` nativo y `zod`, que ya estaba en el workspace
- [x] E2E con el worker real y `AI_FAKE=1`: el resumen llega a la tarjeta sin recargar
- [ ] Coste medido sobre 20 repositorios reales (PA-2): medido sobre uno; queda para antes de encender la IA en producción
