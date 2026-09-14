import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { closeDb, purgeExpiredSessions } from '@rgm/db'
import { readEnv } from '@rgm/shared'
import { processNextJob } from './jobs'

/**
 * El worker: un proceso Node que consume `background_jobs` (ADR-0010). Sin
 * trabajo, espera `POLL_MS`; con trabajo, encadena hasta vaciar la cola.
 * Cada `PURGE_MS` borra las sesiones caducadas (ADR-0013). Arranca con el
 * `.env` de la raíz si existe; en el contenedor las variables llegan del
 * entorno y `dotenv` no las pisa.
 */
const POLL_MS = 2_000
const PURGE_MS = 60 * 60 * 1000

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
