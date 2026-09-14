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

*Motivo: el maestro §21 dice «cambió significativamente» sin definirlo; se fija en `githubPushedAt` posterior a `aiAnalyzedAt`, que es computable.*

## Fuera de alcance

- Embeddings y búsqueda semántica (H5), IA local, análisis del código (R3), fallback a segundo proveedor (roadmap).

## Puntos abiertos que bloquean

`PA-2` proveedor y coste medido sobre 20 repositorios.

## Tickets

Se descompone al cerrar H3. Capas previstas: datos (`repository_analyses`, `categories`, `repository_categories`, `tags`, `ai_usage`, seed de taxonomía), backend/worker (`AIProvider`, registro, prompt, validación, mapeo, caché, trabajo `ANALYZE_REPOSITORY`), frontend (secciones del detalle y estado del análisis en la tarjeta).
