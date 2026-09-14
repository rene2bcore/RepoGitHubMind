import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { closeDb } from '@rgm/db'
import { readEnv } from '@rgm/shared'
import { processNextJob } from './jobs'

/**
 * El worker: un proceso Node que consume `background_jobs` (ADR-0010). Sin
 * trabajo, espera `POLL_MS`; con trabajo, encadena hasta vaciar la cola.
 * Arranca con el `.env` de la raíz y valida las variables como la web.
 */
const POLL_MS = 2_000

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env') })
const env = readEnv()

let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function loop(): Promise<void> {
  console.log(`worker: escuchando la cola (IA ${env.AI_ANALYSIS_ENABLED ? 'activa' : 'apagada'})`)
  while (!stopping) {
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
