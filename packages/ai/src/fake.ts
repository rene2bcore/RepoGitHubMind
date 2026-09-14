import { runStructuredAnalysis } from './analyze'
import type { ChatMessage } from './prompts/analyze'
import type { AIProvider, AnalysisInput, AnalysisOutcome, AnalysisRequest } from './provider'
import type { RepositoryAnalysis } from './schema'

/**
 * `AIProvider` sin red, para pruebas y para desarrollar sin clave
 * (`AI_FAKE=1`). Pasa por el mismo prompt, la misma validación y el mismo
 * reintento que el real: solo cambia de dónde sale el texto. Por defecto
 * responde un análisis determinista construido desde la metadata; con
 * `responses` responde, en orden, cadenas crudas (válidas o no) o errores,
 * que es como una prueba provoca «salida que se pasa de largo» o «proveedor
 * caído». Cuenta las llamadas para que una prueba afirme que no se llamó.
 */
export class FakeAIProvider implements AIProvider {
  readonly name: string
  readonly model: string
  readonly requests: AnalysisRequest[] = []
  readonly messages: ChatMessage[][] = []
  private readonly responses: (string | Error)[]

  constructor(options: { name?: string; model?: string; responses?: (string | Error)[] } = {}) {
    this.name = options.name ?? 'fake'
    this.model = options.model ?? 'fake-analysis'
    this.responses = [...(options.responses ?? [])]
  }

  analyzeRepository(request: AnalysisRequest): Promise<AnalysisOutcome> {
    this.requests.push(request)
    return runStructuredAnalysis(request, async (messages) => {
      this.messages.push(messages)
      const next = this.responses.shift()
      if (next instanceof Error) throw next
      const content = next ?? JSON.stringify(fakeAnalysis(request.repository))
      const prompt = messages.reduce((n, m) => n + m.content.length, 0)
      return {
        content,
        usage: {
          inputTokens: Math.ceil(prompt / 4),
          outputTokens: Math.ceil(content.length / 4),
          estimatedCost: 0,
        },
      }
    })
  }
}

/**
 * El análisis falso de un repositorio: se nota que es de prueba, y sus
 * categorías salen de los topics, así que recorre el mapeador de verdad
 * (`similarity-search` casa por sinónimo; `orchestration` no casa y va a tag).
 */
export function fakeAnalysis(repository: AnalysisInput): RepositoryAnalysis {
  const about = repository.description ?? repository.fullName
  return {
    summary: `Resumen de prueba: ${about}`.slice(0, 200),
    purpose: `Análisis generado sin IA para ${repository.fullName}.`,
    mainUseCases: [`Probar ${repository.fullName} sin llamar a un proveedor`],
    categories: repository.topics.slice(0, 5).map((t) => t.replace(/-/g, ' ')),
    tags: repository.topics.slice(0, 10),
    installationSummary: repository.readme ? 'Según su README.' : '',
    deploymentType: [],
    frameworks: [],
    maturity: repository.latestRelease ? 'estable' : 'sin releases',
    advantages: ['Determinista'],
    limitations: ['No es un análisis real'],
    targetUsers: ['Pruebas'],
    activityAssessment: 'Valoración de prueba.',
    abandonmentRisk: 'UNKNOWN',
    aiConfidence: 0.5,
  }
}
