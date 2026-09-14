import { z } from 'zod'
import { ABANDONMENT_RISKS } from '@rgm/shared'

/**
 * Los topes de la salida. Los cuatro primeros son de la spec (specs/ai ·
 * «Salida estructurada y acotada»); el resto acota lo que la spec deja
 * abierto para que un campo no pueda desbordar la tarjeta ni la base. El
 * prompt los repite en texto: el modelo los ve antes de equivocarse.
 */
export const ANALYSIS_LIMITS = {
  summary: 200,
  mainUseCases: 5,
  advantages: 3,
  limitations: 3,
  text: 400,
  label: 120,
  item: 160,
  categories: 5,
  tags: 10,
  list: 8,
} as const

const L = ANALYSIS_LIMITS
const item = z.string().trim().min(1).max(L.item)
const list = (max: number) => z.array(item).max(max)

/**
 * La forma que el proveedor tiene que devolver, validada antes de guardar
 * nada. `categories` es texto libre: lo decide el mapeador contra el
 * catálogo, nunca el modelo.
 */
export const repositoryAnalysisSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .max(L.summary)
    .describe('Una frase, 200 caracteres como máximo'),
  purpose: z
    .string()
    .trim()
    .min(1)
    .max(L.text)
    .describe('Para qué sirve, 400 caracteres como máximo'),
  mainUseCases: list(L.mainUseCases).describe('Hasta 5 casos de uso'),
  categories: list(L.categories).describe('Hasta 5 rutas del catálogo de categorías'),
  tags: list(L.tags).describe('Hasta 10 términos cortos en minúsculas'),
  installationSummary: z
    .string()
    .trim()
    .max(L.text)
    .describe('Cómo se instala; vacío si no consta'),
  deploymentType: list(L.list),
  frameworks: list(L.list),
  maturity: z.string().trim().max(L.label).describe('Valoración corta de madurez'),
  advantages: list(L.advantages).describe('Hasta 3 ventajas'),
  limitations: list(L.limitations).describe('Hasta 3 limitaciones'),
  targetUsers: list(L.list),
  activityAssessment: z.string().trim().max(L.text),
  abandonmentRisk: z.enum(ABANDONMENT_RISKS),
  aiConfidence: z.number().min(0).max(1),
})
export type RepositoryAnalysis = z.infer<typeof repositoryAnalysisSchema>

/**
 * El esquema JSON que viaja en `response_format`. Sin `maxLength` ni
 * `minLength`: no todos los modelos que hay detrás de un proveedor
 * compatible con OpenAI los aceptan, y una petición rechazada por un
 * adjetivo del esquema es peor que un tope que se valida aquí y se corrige
 * con un reintento.
 */
export function analysisJsonSchema(): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip)
    if (!node || typeof node !== 'object') return node
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => k !== '$schema' && k !== 'maxLength' && k !== 'minLength')
        .map(([k, v]) => [k, strip(v)]),
    )
  }
  return strip(z.toJSONSchema(repositoryAnalysisSchema)) as Record<string, unknown>
}

export type ParsedAnalysis =
  { success: true; data: RepositoryAnalysis } | { success: false; issues: string[] }

/**
 * Lee el contenido que devolvió el modelo. Tolera la valla de Markdown que
 * algunos modelos ponen aunque se les pida JSON; no tolera nada más.
 */
export function parseAnalysis(content: string): ParsedAnalysis {
  const text = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { success: false, issues: ['la respuesta no es un objeto JSON válido'] }
  }
  const result = repositoryAnalysisSchema.safeParse(raw)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    issues: result.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`),
  }
}
