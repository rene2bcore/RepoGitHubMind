# ai Specification

## Purpose

Entiende cada repositorio por la persona: un resumen corto, para qué sirve, casos de uso, categorías del catálogo, tags, madurez y actividad. Una vez por repositorio, para todos, con cualquier proveedor. Es la capability que convierte una lista de URLs en una biblioteca.

Historia: H4 · RGM-5. Arquitectura en [`../../ai-architecture.md`](../../ai-architecture.md).

## Requirements

### Requirement: Un análisis por repositorio

El sistema SHALL analizar cada `Repository` global una sola vez y SHALL reutilizar el análisis para cualquier cuenta que guarde el mismo repositorio. SHALL volver a analizar solo cuando `githubPushedAt` sea posterior a `aiAnalyzedAt`, cuando el análisis haya caducado, o cuando se fuerce.

#### Scenario: Segunda cuenta

- **WHEN** Ada guardó `langchain-ai/langgraph` y fue analizado, y Grace lo guarda
- **THEN** Grace ve el mismo análisis al momento y no se registra ninguna fila nueva en `ai_usage`

#### Scenario: Repositorio que cambió

- **WHEN** un repositorio analizado recibe pushes posteriores a `aiAnalyzedAt` y alguien lo vuelve a guardar o fuerza el análisis
- **THEN** se encola un nuevo análisis y el anterior se conserva hasta que termine

### Requirement: Salida estructurada y acotada

El análisis SHALL producir `summary` de hasta 200 caracteres, `purpose`, hasta 5 `mainUseCases`, `categories`, `tags`, `installationSummary`, `deploymentType`, `frameworks`, `maturity`, hasta 3 `advantages`, hasta 3 `limitations`, `targetUsers`, `activityAssessment`, `abandonmentRisk` en `LOW`, `MEDIUM`, `HIGH` o `UNKNOWN`, y `aiConfidence` entre 0 y 1. La salida SHALL validarse antes de guardarse; una salida que no valide SHALL reintentarse una vez y después quedar `FAILED`.

#### Scenario: Salida válida

- **WHEN** el proveedor responde JSON con la forma acordada
- **THEN** se guarda en `repository_analyses` con `status` `COMPLETED`, `provider`, `model` y `aiAnalyzedAt`

#### Scenario: Salida que se pasa de largo

- **WHEN** el proveedor responde un `summary` de 400 caracteres o 7 casos de uso
- **THEN** no se guarda; se reintenta pidiendo corrección, y si vuelve a fallar el análisis queda `FAILED`

### Requirement: Contexto económico

El sistema SHALL enviar al proveedor solo metadata de GitHub, el README truncado a `AI_MAX_README_CHARS`, topics, lenguajes, licencia y releases. NO SHALL clonar ni enviar código del repositorio.

#### Scenario: README enorme

- **WHEN** el README supera `AI_MAX_README_CHARS`
- **THEN** se envía truncado conservando la cabecera y las secciones de instalación y uso, y el análisis se completa igual

### Requirement: Categorías del catálogo

El sistema SHALL mapear las categorías sugeridas al catálogo controlado de [`../../taxonomy.md`](../../taxonomy.md) por slug, nombre o sinónimo, SHALL guardar lo que no mapee como tag de IA, y NO SHALL crear categorías nuevas.

#### Scenario: Sugerencia mapeable

- **WHEN** la IA sugiere «vector similarity search»
- **THEN** el repositorio queda en `data/databases/vector` con `origin` `AI` y su `confidence`

#### Scenario: Sugerencia que no existe

- **WHEN** la IA sugiere «quantum finance»
- **THEN** no aparece ninguna categoría nueva; queda como tag de IA y se cuenta como no mapeada

### Requirement: Proveedor reemplazable

El sistema SHALL elegir proveedor y modelo desde `AI_PROVIDER`, `AI_MODEL_ANALYSIS`, `AI_EMBEDDING_PROVIDER` y `AI_MODEL_EMBEDDING`, y NO SHALL contener ningún nombre de modelo en el código salvo el valor por defecto de cada proveedor, en un único sitio documentado (`packages/ai/src/defaults.ts`), que solo se usa con la variable vacía.

#### Scenario: Cambiar de proveedor

- **WHEN** se cambia `AI_PROVIDER` y se reinicia el worker
- **THEN** los análisis nuevos se registran en `ai_usage` con el proveedor nuevo, sin cambio de código

#### Scenario: Proveedor desconocido

- **WHEN** `AI_PROVIDER` tiene un valor que el registro no conoce
- **THEN** el worker no arranca y lo dice con un mensaje claro; no falla en silencio en la primera llamada

### Requirement: La IA nunca impide guardar

Si el proveedor falla, está deshabilitado o el análisis no valida, el repositorio SHALL seguir guardado y usable, y la interfaz SHALL mostrar «Análisis no disponible» con opción de reintentar. Con `AI_ANALYSIS_ENABLED=false` NO SHALL hacerse ninguna llamada ni registrarse coste.

#### Scenario: Proveedor caído

- **WHEN** el proveedor responde error o no responde
- **THEN** el trabajo queda `FAILED` con `lastError`, el repositorio sigue en la biblioteca, y se puede reintentar

#### Scenario: IA desactivada

- **WHEN** `AI_ANALYSIS_ENABLED=false`
- **THEN** guardar funciona, `analysis.status` es `DISABLED`, y `ai_usage` no gana filas

### Requirement: Todo uso se registra

Cada llamada SHALL escribir en `ai_usage` proveedor, modelo, operación, tokens de entrada y salida, coste estimado, repositorio, fecha y éxito.

#### Scenario: Coste por repositorio

- **WHEN** se analiza un repositorio
- **THEN** existe una fila con sus tokens y su coste estimado, y la suma por repositorio responde cuánto costó

### Requirement: Riesgo de abandono como valoración

La interfaz SHALL mostrar `maturity` y `abandonmentRisk` etiquetados como valoración de IA o heurística, y NO SHALL presentarlos como hecho ni con una precisión que no tiene. La heurística SHALL ser transparente: `HIGH` si archivado o sin push en 18 meses, `MEDIUM` sin push en 6 meses, `LOW` con push en 6 meses, `UNKNOWN` sin datos.

#### Scenario: Repositorio archivado

- **WHEN** GitHub marca el repositorio como archivado
- **THEN** el riesgo es `HIGH` aunque la IA diga otra cosa, y se muestra como «Valoración heurística»

#### Scenario: Sin precisión falsa

- **WHEN** se muestra el riesgo
- **THEN** no aparece ningún porcentaje ni puntuación decimal
