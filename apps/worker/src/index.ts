import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { getAIProvider, getEmbeddingProvider } from '@rgm/ai'
import { closeDb, purgeExpiredSessions } from '@rgm/db'
import { readEnv } from '@rgm/shared'
import { processNextJob } from './jobs'

/**
 * El worker: un proceso Node que consume `background_jobs` (ADR-0010). Sin
 * trabajo, espera `POLL_MS`; con trabajo, encadena hasta vaciar la cola.
 * Cada `PURGE_MS` borra las sesiones caducadas (ADR-0013). Arranca con el
 * `.env` de la raíz si existe; en el contenedor las variables llegan del
 * entorno y `dotenv` no las pisa.
 *
 * Con la IA activa, los proveedores de análisis y de embeddings se eligen al
 * arrancar: un `AI_PROVIDER` o `AI_EMBEDDING_PROVIDER` desconocido, o la
 * falta de clave, para el proceso con un mensaje claro, en vez de fallar en
 * la primera llamada (specs/ai · «Proveedor desconocido»).
 */
const POLL_MS = 2_000
const PURGE_MS = 60 * 60 * 1000

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') })
const env = readEnv()

let ai = 'apagada'
if (env.AI_ANALYSIS_ENABLED) {
  try {
    const provider = getAIProvider()
    const embeddings = getEmbeddingProvider()
    ai = `activa con ${provider.name} (${provider.model}), embeddings con ${embeddings.name} (${embeddings.model})`
  } catch (error) {
    console.error(`worker: no arranca. ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function loop(): Promise<void> {
  console.log(`worker: escuchando la cola (IA ${ai})`)
  let nextPurge = 0
  while (!stopping) {
    if (Date.now() >= nextPurge) {
      nextPurge = Date.now() + PURGE_MS
      await purgeExpiredSessions()
        .then((n) => n && console.log(`worker: ${n} sesiones caducadas borradas`))
        .catch((error: unknown) => console.error('worker: fallo purgando sesiones', error))
    }
    const result = await processNextJob().catch((error: unknown) => {
      console.error('worker: fallo tomando un trabajo', error)
      return null
    })
    if (result) {
      console.log(`worker: ${result.job.type} ${result.job.id} -> ${result.outcome}`)
      continue
    }
    await sleep(POLL_MS)
  }
  await closeDb()
}

void loop()
