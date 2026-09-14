import { AIOutputInvalidError, AIProviderCallError } from './errors'
import { buildAnalysisMessages, correctionMessage, type ChatMessage } from './prompts/analyze'
import type { AICallUsage, AnalysisOutcome, AnalysisRequest } from './provider'
import { parseAnalysis } from './schema'

export type ChatCompletion = {
  content: string
  usage: Pick<AICallUsage, 'inputTokens' | 'outputTokens' | 'estimatedCost'>
}

/** Una llamada de chat al proveedor. Lanza `AIProviderCallError` si no hay respuesta utilizable. */
export type ChatTransport = (messages: ChatMessage[]) => Promise<ChatCompletion>

/**
 * El análisis estructurado, igual para cualquier proveedor: prompt, llamada,
 * validación con Zod y, si la salida no valida, **un** reintento con la
 * salida anterior y la lista de errores (specs/ai · «Salida que se pasa de
 * largo»). Si la corrección tampoco valida, `AIOutputInvalidError`. Cada
 * llamada queda en `calls`, también las fallidas.
 */
export async function runStructuredAnalysis(
  request: AnalysisRequest,
  transport: ChatTransport,
): Promise<AnalysisOutcome> {
  let messages = buildAnalysisMessages(request)
  const calls: AICallUsage[] = []
  for (let attempt = 1; ; attempt++) {
    let completion: ChatCompletion
    try {
      completion = await transport(messages)
    } catch (error) {
      if (error instanceof AIProviderCallError) error.calls = [...calls, ...error.calls]
      throw error
    }
    const parsed = parseAnalysis(completion.content)
    if (parsed.success) {
      calls.push({ ...completion.usage, success: true, error: null })
      return { analysis: parsed.data, calls }
    }
    calls.push({
      ...completion.usage,
      success: false,
      error: `salida inválida: ${parsed.issues.join('; ')}`.slice(0, 500),
    })
    if (attempt >= 2) throw new AIOutputInvalidError(parsed.issues, calls)
    messages = [
      ...messages,
      { role: 'assistant', content: completion.content.slice(0, 8000) },
      correctionMessage(parsed.issues),
    ]
  }
}
