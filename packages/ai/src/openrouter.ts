import { runStructuredAnalysis, type ChatCompletion } from './analyze'
import { AIProviderCallError } from './errors'
import type { ChatMessage } from './prompts/analyze'
import type { AIProvider, AnalysisOutcome, AnalysisRequest } from './provider'
import { analysisJsonSchema } from './schema'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

type FetchLike = typeof fetch

type ChatResponse = {
  choices?: { message?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  error?: { code?: number | string; message?: string }
}

/**
 * `AIProvider` sobre OpenRouter, que habla el formato de chat de OpenAI y da
 * acceso a varios modelos con una clave (ADR-0009, PA-2). El modelo llega de
 * fuera (`AI_MODEL_ANALYSIS` o el valor por defecto de `defaults.ts`); aquí
 * no se nombra ninguno. La clave solo viaja en la cabecera `Authorization` y
 * no aparece en ningún mensaje de error.
 *
 * Pide salida estructurada con `response_format` y `require_parameters`, para
 * que OpenRouter no enrute a un proveedor que ignore el esquema, y el coste
 * que OpenRouter declara en `usage.cost`.
 *
 * Reintentables (la cola los repite con backoff): red, tiempo agotado, `408`,
 * `429` (con `retry-after` si viene) y `5xx`. No reintentables: `400`, `401`,
 * `402`, `403`, porque esperar no arregla una clave o una petición mal hechas.
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter'
  readonly model: string

  constructor(
    private readonly options: {
      apiKey: string
      model: string
      fetchImpl?: FetchLike
      timeoutMs?: number
      maxTokens?: number
    },
  ) {
    this.model = options.model
  }

  analyzeRepository(request: AnalysisRequest): Promise<AnalysisOutcome> {
    return runStructuredAnalysis(request, (messages) => this.complete(messages))
  }

  private async complete(messages: ChatMessage[]): Promise<ChatCompletion> {
    const body = {
      model: this.model,
      messages,
      temperature: 0.2,
      max_tokens: this.options.maxTokens ?? 2000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'repository_analysis', strict: true, schema: analysisJsonSchema() },
      },
      provider: { require_parameters: true },
      usage: { include: true },
    }
    let res: Response
    try {
      res = await (this.options.fetchImpl ?? fetch)(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/rene2bcore/RepoGitHubMind',
          'X-Title': 'RepoGitHubMind',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 60_000),
      })
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'tiempo agotado' : 'red'
      throw new AIProviderCallError(`OpenRouter no respondió (${reason})`, { retryable: true })
    }

    const json = (await res.json().catch(() => null)) as ChatResponse | null
    if (!res.ok) {
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500
      throw new AIProviderCallError(`OpenRouter respondió ${res.status}${detail(json)}`, {
        retryable,
        retryAfter: retryAfterFrom(res),
      })
    }
    if (!json || json.error) {
      throw new AIProviderCallError(`OpenRouter devolvió un error${detail(json)}`, {
        retryable: true,
      })
    }
    return {
      content: json.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        estimatedCost: typeof json.usage?.cost === 'number' ? json.usage.cost : null,
      },
    }
  }
}

/** El mensaje de error del proveedor, corto: va a `last_error`, nunca a la API. */
function detail(json: ChatResponse | null): string {
  const message = json?.error?.message
  return message ? `: ${String(message).slice(0, 200)}` : ''
}

function retryAfterFrom(res: Response): Date | undefined {
  const seconds = Number(res.headers.get('retry-after'))
  return seconds > 0 ? new Date(Date.now() + seconds * 1000) : undefined
}
