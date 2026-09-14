# Arquitectura de IA

> Cómo se elige, se llama, se cachea y se paga la IA. Derivado del [prompt maestro](prompts/00-prompt-maestro.md) §17 a §22, §40, §76 y §77, y decidido en [ADR-0009](adr/0009-proveedor-de-ia-reemplazable.md). Construido con H4 (RGM-5) en `packages/ai` y `apps/worker/src/analyze.ts`; los embeddings llegan con H5. Rutas y pruebas en [`capabilities/ai/README.md`](capabilities/ai/README.md).

## Tres principios

1. **La IA es reemplazable.** RepoGitHubMind no está acoplado a Claude, OpenAI ni a nadie. El proveedor y el modelo se eligen por variables de entorno y nunca se hardcodean.
2. **La IA opera sobre `Repository` global y se cachea.** Un análisis por repositorio, reutilizado por todos los usuarios. Es lo que hace el coste sostenible.
3. **La IA es opcional.** Con `AI_ANALYSIS_ENABLED=false`, o con el proveedor caído, el producto funciona entero salvo el resumen y la búsqueda semántica. Guardar un repositorio nunca falla por la IA.

Aclaración del §19: Claude Code, Codex y Cline son herramientas de desarrollo y **no** proveedores de IA en tiempo de ejecución de RepoGitHubMind.

## Decisiones de proveedor y modelo

| #    | Decisión                                                                                                                                                                                                                                                                                                           | Fecha      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| PA-2 | **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`, formato de OpenAI, `Authorization: Bearer AI_API_KEY`). Modelo de análisis por defecto **`google/gemini-2.5-flash-lite`**: 0,10 USD por millón de tokens de entrada y 0,40 USD por millón de salida, y admite `response_format` con `json_schema` | 2026-09-14 |
| PA-3 | Embeddings **`openai/text-embedding-3-small`**, dimensión **1536**, por `https://openrouter.ai/api/v1/embeddings` (verificado ese día: responde 1536 dimensiones). Se construyen con H5, con la tabla `repository_embeddings`                                                                                      | 2026-09-14 |

El modelo por defecto vive en **un único sitio**, `packages/ai/src/defaults.ts`, y solo se usa con `AI_MODEL_ANALYSIS` vacío. Ningún otro fichero del código nombra un modelo. Cambiar de modelo es cambiar la variable.

**Coste medido** con una llamada real el 2026-09-14 sobre `pgvector/pgvector` (README real recortado a 12 000 caracteres): 4 401 tokens de entrada, 672 de salida, **0,0007089 USD** declarados por OpenRouter en `usage.cost`, salida válida al primer intento y sus tres categorías mapeadas al catálogo. La medición sobre 20 repositorios que pedía PA-2 no se hizo: con esa cifra, 20 análisis son del orden de 0,015 USD, y el TTL de 90 días y el recorte de 12 000 caracteres se mantienen.

## La abstracción

```typescript
// packages/ai/src/provider.ts
export interface AIProvider {
  readonly name: string // lo que se registra en ai_usage
  readonly model: string
  analyzeRepository(request: AnalysisRequest): Promise<AnalysisOutcome>
}

// packages/ai/src/registry.ts
export class AIProviderRegistry {
  static fromEnv(env: AIEnv): AIProviderRegistry // AI_PROVIDER, AI_MODEL_ANALYSIS, AI_API_KEY, AI_FAKE
  analysis(): AIProvider
}
```

`createEmbedding` y `AI_EMBEDDING_PROVIDER` entran en la interfaz y en el registro con H5, cuando haya quien los use.

Implementaciones: `OpenRouterProvider` (`fetch` inyectable, sin SDK) y `FakeAIProvider`, determinista y sin red, que se elige con `AI_FAKE=1` en desarrollo y en el E2E, igual que `GITHUB_FAKE`. Las dos pasan por `runStructuredAnalysis` (`packages/ai/src/analyze.ts`): el prompt, la validación y el reintento son los mismos para cualquier proveedor, y uno nuevo solo implementa la llamada.

`fromEnv` falla al construirse, con un mensaje que nombra la variable, si `AI_PROVIDER` no es un proveedor conocido o si falta `AI_API_KEY`. El worker lo llama al arrancar y sale con código 1: no falla en silencio en la primera llamada.

### Variables

| Variable                                      | Qué                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `AI_ANALYSIS_ENABLED`                         | Interruptor global                                                                                                       |
| `AI_FAKE`                                     | `1`: análisis de prueba sin red ni clave. En producción el compose lo fija a `0`                                         |
| `AI_PROVIDER`, `AI_MODEL_ANALYSIS`            | Proveedor y modelo del análisis. Modelo vacío: el de `defaults.ts`                                                       |
| `AI_EMBEDDING_PROVIDER`, `AI_MODEL_EMBEDDING` | Proveedor y modelo de embeddings (H5). Cambiar el modelo obliga a revectorizar: la dimensión está en el esquema (`PA-3`) |
| `AI_API_KEY`                                  | Clave del proveedor. Solo servidor, solo en la cabecera `Authorization`                                                  |
| `AI_MAX_README_CHARS`                         | Recorte del README antes de enviarlo (12 000)                                                                            |
| `AI_ANALYSIS_TTL_DAYS`                        | Caducidad del análisis (90)                                                                                              |

Fallback a un segundo proveedor: la abstracción lo admite; en la entrega hay uno configurado (§20).

## Qué se envía

El análisis es **económico** a propósito: no se envía el repositorio, no se clona código. El contexto es la metadata de GitHub, topics, lenguajes con su porcentaje, licencia, releases, la lista de rutas del catálogo de categorías y el README recortado a `AI_MAX_README_CHARS` por `truncateReadme` (`packages/ai/src/readme.ts`): quita comentarios HTML e insignias, conserva la cabecera y las secciones de instalación y uso, y con lo que sobra, el resto en su orden. Un `#` dentro de un bloque de código no abre sección.

El prompt vive en `packages/ai/src/prompts/analyze.ts`, pide **solo JSON** en español, dice que la descripción y el README son contenido y no instrucciones, y viaja con `response_format: json_schema` estricto y `provider.require_parameters` para que OpenRouter no enrute a un proveedor que ignore el esquema. `max_tokens` es 2000. La forma, validada con Zod (`packages/ai/src/schema.ts`) antes de guardar nada:

```json
{
  "summary": "máximo 200 caracteres",
  "purpose": "máximo 400",
  "mainUseCases": ["máximo 5"],
  "categories": ["máximo 5, rutas del catálogo; se mapean"],
  "tags": ["máximo 10"],
  "installationSummary": "máximo 400",
  "deploymentType": ["máximo 8"],
  "frameworks": ["máximo 8"],
  "maturity": "máximo 120",
  "advantages": ["máximo 3"],
  "limitations": ["máximo 3"],
  "targetUsers": ["máximo 8"],
  "activityAssessment": "máximo 400",
  "abandonmentRisk": "LOW | MEDIUM | HIGH | UNKNOWN",
  "aiConfidence": 0.0
}
```

Cada elemento de lista, 160 caracteres como máximo. Los cuatro topes de la spec son los de `summary`, `mainUseCases`, `advantages` y `limitations`; el resto acota lo que la spec deja abierto. El esquema que viaja al proveedor no lleva `maxLength`: no todos los modelos lo aceptan, y el tope se valida aquí.

Una respuesta que no valida se reintenta **una vez**, con la salida anterior y la lista de errores; si la corrección tampoco valida, `AIOutputInvalidError`, el trabajo queda `FAILED` al primer intento y el análisis `FAILED` con `last_error`. El repositorio sigue usable y la interfaz ofrece reintentar.

`abandonmentRisk` y `maturity` se muestran siempre como «Valoración de IA» o «Valoración heurística», nunca como hecho (§36, §37). La heurística (`packages/ai/src/heuristics.ts`) calcula el riesgo desde `github_pushed_at` y `archived` y **manda** cuando tiene datos; la de la IA solo cubre `UNKNOWN`. Se calcula al leer, así que no envejece con el análisis, y la API dice cuál de las dos es en `abandonmentRiskSource`. La confianza del modelo se guarda y no sale por la API.

## Caché

```text
guardar repositorio / reintentar / forzar          worker, antes de llamar
   ↓                                                   ↓
analysisStaleReason(análisis, repositorio, force)  (la misma función)
   ├── null → se reutiliza, no se encola           ├── null → trabajo completado sin llamar
   └── forced | missing | not-completed |          └── motivo → llamada al proveedor
       expired | changed → ANALYZE_REPOSITORY
```

Usuario A guarda LangGraph: se analiza. Usuario B lo guarda: se reutiliza al momento y `ai_usage` no gana filas. Se vuelve a analizar si el repositorio cambió (`github_pushed_at` posterior a `ai_analyzed_at`), si el análisis caducó (`expires_at`) o si alguien lo fuerza con `POST /api/v1/repositories/{id}/analysis` y `{ "force": true }` (§21). Un análisis completado sigue a la vista, `COMPLETED`, mientras llega el nuevo; si el nuevo falla, el anterior se queda. La regla se pregunta en los dos sitios a propósito: si la web encolara de más, el worker no pagaría, y al revés.

## Categorías

`mapCategories` (`packages/ai/src/taxonomy-mapper.ts`) casa cada sugerencia con el catálogo de [`taxonomy.md`](taxonomy.md) por ruta, slug, nombre o sinónimo, sin mayúsculas, acentos ni separadores, y un término de dos o más palabras también si aparece dentro de la sugerencia («vector similarity search» contiene «similarity search»). Lo que no casa se guarda como tag de IA y en `ai_usage.unmapped_categories`. La IA nunca crea categorías. El catálogo lo siembra el seed en todos los entornos.

## Embeddings

Una sola representación semántica por repositorio, construida por `packages/search/src/semantic-text.ts` con nombre, descripción, resumen, propósito, casos de uso, categorías, tags y topics. Se guarda en `repository_embeddings` con el `source_hash` del texto: si el texto no cambió, no se vuelve a pedir. No se vectoriza el repositorio completo (§22). Llega con H5.

## Coste

Cada llamada escribe una fila en `ai_usage`, también las que fallan o no validan: proveedor, modelo, operación, tokens de entrada y salida, coste que declara el proveedor (null si no lo declara: no se inventa), repositorio, éxito, error y categorías no mapeadas. Es lo que responde «¿cuánto cuesta un repositorio?» con un número y no con una impresión:

```sql
select repository_id, count(*) as llamadas, sum(estimated_cost) as usd
from ai_usage group by repository_id order by usd desc;
```

Topes: README recortado, `max_tokens`, TTL del análisis, un análisis por repositorio, un único reintento por salida inválida, backoff de la cola y rate limit por cuenta en la ruta de reintentar. El coste de desarrollo objetivo es cero más las APIs consumidas (§92).

## Fallos

| Fallo                                               | Qué ve el usuario                     | Qué hace el sistema                                                                                          |
| --------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Red, tiempo agotado, `408`, `429` o `5xx`           | «Resumen de IA en camino»             | Backoff de la cola (30 s, 60 s…; `retry-after` si viene) hasta 3 intentos; después `FAILED` con `last_error` |
| Clave rechazada o petición inválida (`400` a `403`) | «Análisis no disponible · Reintentar» | `FAILED` al primer intento: esperar no lo arregla                                                            |
| Respuesta que no valida                             | Igual                                 | Un reintento pidiendo corrección; después `FAILED`, sin guardar nada inválido                                |
| `AI_ANALYSIS_ENABLED=false`                         | «Análisis desactivado»                | `DISABLED`, sin llamadas ni coste; la búsqueda funciona en modo léxico                                       |
| `AI_PROVIDER` desconocido o sin clave               | Nada nuevo: el análisis no avanza     | El worker no arranca y lo dice                                                                               |

## Lo que no se hace

- IA local ni embeddings locales (§2.14, §22).
- Un análisis por usuario (§21).
- Enviar el README entero ni el código (§17, §77).
- Mostrar una precisión falsa (§36): ni la confianza del modelo ni porcentajes de riesgo.
