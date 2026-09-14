# Arquitectura de IA

> Cómo se elige, se llama, se cachea y se paga la IA. Derivado del [prompt maestro](prompts/00-prompt-maestro.md) §17 a §22, §40, §76 y §77, y decidido en [ADR-0009](adr/0009-proveedor-de-ia-reemplazable.md). Sin código todavía ([H-01](hallazgos.md)).

## Tres principios

1. **La IA es reemplazable.** RepoGitHubMind no está acoplado a Claude, OpenAI ni a nadie. El proveedor y el modelo se eligen por variables de entorno y nunca se hardcodean.
2. **La IA opera sobre `Repository` global y se cachea.** Un análisis por repositorio, reutilizado por todos los usuarios. Es lo que hace el coste sostenible.
3. **La IA es opcional.** Con `AI_ANALYSIS_ENABLED=false`, o con el proveedor caído, el producto funciona entero salvo el resumen y la búsqueda semántica. Guardar un repositorio nunca falla por la IA.

Aclaración del §19: Claude Code, Codex y Cline son herramientas de desarrollo y **no** proveedores de IA en tiempo de ejecución de RepoGitHubMind.

## La abstracción

```typescript
// packages/ai/src/provider.ts
export interface AIProvider {
  readonly name: string
  analyzeRepository(input: AnalysisInput): Promise<RepositoryAnalysis>
  createEmbedding(input: EmbeddingInput): Promise<number[]>
}

// packages/ai/src/registry.ts
export class AIProviderRegistry {
  static fromEnv(env: AIEnv): AIProviderRegistry // AI_PROVIDER, AI_EMBEDDING_PROVIDER
  analysis(): AIProvider
  embedding(): AIProvider
}
```

Implementaciones previstas, en este orden: OpenRouter (cubre varios modelos con una clave), OpenAI, Anthropic, Google. Todas hablan HTTP JSON con el servidor; ninguna corre en local.

### Variables

| Variable                                      | Qué                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AI_ANALYSIS_ENABLED`                         | Interruptor global                                                                                                  |
| `AI_PROVIDER`, `AI_MODEL_ANALYSIS`            | Proveedor y modelo del análisis                                                                                     |
| `AI_EMBEDDING_PROVIDER`, `AI_MODEL_EMBEDDING` | Proveedor y modelo de embeddings. Cambiar el modelo obliga a revectorizar: la dimensión está en el esquema (`PA-3`) |
| `AI_API_KEY`                                  | Clave del proveedor. Solo servidor                                                                                  |
| `AI_MAX_README_CHARS`                         | Truncado del README antes de enviarlo                                                                               |
| `AI_ANALYSIS_TTL_DAYS`                        | Caducidad del análisis                                                                                              |

Fallback a un segundo proveedor: la abstracción lo admite; en la entrega hay uno configurado (§20).

## Qué se envía

El análisis es **económico** a propósito: no se envía el repositorio, no se clona código. El contexto es la metadata de GitHub, el README truncado a `AI_MAX_README_CHARS` con truncado inteligente (cabecera, secciones de instalación y uso antes que el resto), topics, lenguajes, licencia y releases.

El prompt del análisis vive en `packages/ai/src/prompts/analyze.ts` y pide **solo JSON** con esta forma, validada con Zod antes de guardarse:

```json
{
  "summary": "máximo 200 caracteres",
  "purpose": "",
  "mainUseCases": ["máximo 5"],
  "categories": ["texto libre, se mapea al catálogo"],
  "tags": [],
  "installationSummary": "",
  "deploymentType": [],
  "frameworks": [],
  "maturity": "",
  "advantages": ["máximo 3"],
  "limitations": ["máximo 3"],
  "targetUsers": [],
  "activityAssessment": "",
  "abandonmentRisk": "LOW | MEDIUM | HIGH | UNKNOWN",
  "aiConfidence": 0.0
}
```

Una respuesta que no valide se reintenta una vez pidiendo corrección; si vuelve a fallar, el análisis queda `FAILED` con reintento manual, y el repositorio sigue usable.

`abandonmentRisk` y `maturity` se muestran siempre como «valoración de IA / heurística», nunca como hecho (§36, §37). Las heurísticas deterministas (`packages/ai/src/heuristics.ts`) calculan el riesgo desde `github_pushed_at` y `archived`, y la IA solo lo matiza.

## Caché

```text
guardar repositorio
   ↓
¿existe repository_analyses con status COMPLETED,
 expires_at en el futuro,
 y ai_analyzed_at posterior a github_pushed_at?
   ├── sí → se reutiliza, no se llama a la IA
   └── no → se encola ANALYZE_REPOSITORY
```

Usuario A guarda LangGraph: se analiza. Usuario B lo guarda: se reutiliza. Se vuelve a analizar solo si el repositorio cambió (`github_pushed_at` más reciente que el análisis), el análisis caducó (`expires_at`) o alguien lo fuerza (§21).

## Embeddings

Una sola representación semántica por repositorio, construida por `packages/search/src/semantic-text.ts` con nombre, descripción, resumen, propósito, casos de uso, categorías, tags y topics. Se guarda en `repository_embeddings` con el `source_hash` del texto: si el texto no cambió, no se vuelve a pedir. No se vectoriza el repositorio completo (§22).

## Coste

Cada llamada escribe una fila en `ai_usage`: proveedor, modelo, operación, tokens de entrada y salida, coste estimado, repositorio, éxito. Es lo que responde «¿cuánto cuesta un repositorio?» con un número y no con una impresión, y lo que decide `PA-2`.

Topes: README truncado, `max_tokens` en la petición, TTL del análisis, un análisis por repositorio. El coste de desarrollo objetivo es cero más las APIs consumidas (§92).

## Fallos

| Fallo                            | Qué ve el usuario                     | Qué hace el sistema                                                               |
| -------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Proveedor caído o clave inválida | «Análisis no disponible · Reintentar» | El trabajo queda `FAILED` con `last_error`; el repositorio está guardado y usable |
| Respuesta que no valida          | Igual                                 | Un reintento pidiendo corrección; después `FAILED`                                |
| `AI_ANALYSIS_ENABLED=false`      | «Análisis desactivado»                | `DISABLED`, sin llamadas ni coste; la búsqueda funciona en modo léxico            |
| Rate limit del proveedor         | Nada: el análisis llega más tarde     | Backoff en la cola                                                                |

## Lo que no se hace

- IA local ni embeddings locales (§2.14, §22).
- Un análisis por usuario (§21).
- Enviar el README entero ni el código (§17, §77).
- Mostrar una precisión falsa (§36).
