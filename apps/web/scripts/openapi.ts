import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDocument, serialize } from '../src/openapi/document'

/**
 * Dos modos sobre `docs/api/openapi.json`, en la raíz del monorepo:
 *
 * - `generate` escribe el contrato desde los esquemas Zod.
 * - `check` compara el fichero versionado con el generado y **sale 1** si
 *   difieren, nombrando las rutas JSON. No arregla nada: el arreglo es
 *   `pnpm openapi:generate` en local, y el humano en el bucle (ADR-0001).
 */
const DESTINO = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'api',
  'openapi.json',
)

type Json = unknown
type Diferencia = {
  ruta: string
  motivo: 'valor distinto' | 'sobra en el fichero' | 'falta en el fichero'
}

const esObjeto = (v: Json): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Devuelve rutas JSON y no un diff de texto: el documento pasa de las
 * setecientas líneas, y `paths./api/v1/auth/login.post.responses.200` dice
 * qué parte del contrato cambió.
 */
export function comparar(fichero: Json, generado: Json, ruta = ''): Diferencia[] {
  if (esObjeto(fichero) && esObjeto(generado)) {
    const claves = new Set([...Object.keys(fichero), ...Object.keys(generado)])
    const out: Diferencia[] = []
    for (const clave of claves) {
      const hija = ruta ? `${ruta}.${clave}` : clave
      if (!(clave in generado)) out.push({ ruta: hija, motivo: 'sobra en el fichero' })
      else if (!(clave in fichero)) out.push({ ruta: hija, motivo: 'falta en el fichero' })
      else out.push(...comparar(fichero[clave], generado[clave], hija))
    }
    return out
  }
  if (Array.isArray(fichero) && Array.isArray(generado)) {
    const out: Diferencia[] = []
    for (let i = 0; i < Math.max(fichero.length, generado.length); i++) {
      const hija = `${ruta}[${i}]`
      if (i >= generado.length) out.push({ ruta: hija, motivo: 'sobra en el fichero' })
      else if (i >= fichero.length) out.push({ ruta: hija, motivo: 'falta en el fichero' })
      else out.push(...comparar(fichero[i], generado[i], hija))
    }
    return out
  }
  return JSON.stringify(fichero) !== JSON.stringify(generado)
    ? [{ ruta: ruta || '(raíz)', motivo: 'valor distinto' }]
    : []
}

async function main() {
  const modo = process.argv[2]
  if (modo !== 'generate' && modo !== 'check') {
    console.error('Uso: tsx scripts/openapi.ts generate|check')
    process.exit(2)
  }
  const generado = buildDocument()
  const contenido = serialize(generado)

  if (modo === 'generate') {
    await mkdir(dirname(DESTINO), { recursive: true })
    await writeFile(DESTINO, contenido, 'utf8')
    console.log(`docs/api/openapi.json escrito (${contenido.length} bytes)`)
    return
  }

  let versionado: string
  try {
    versionado = await readFile(DESTINO, 'utf8')
  } catch {
    console.error('docs/api/openapi.json no existe. Ejecuta `pnpm openapi:generate`.')
    process.exit(1)
  }
  if (versionado === contenido) {
    console.log('docs/api/openapi.json coincide con el documento generado')
    return
  }
  const diferencias = comparar(JSON.parse(versionado), JSON.parse(contenido))
  console.error('docs/api/openapi.json ya no es el contrato que genera el código.')
  if (!diferencias.length)
    console.error('El contenido coincide y el formato no. Ejecuta `pnpm openapi:generate`.')
  for (const { ruta, motivo } of diferencias.slice(0, 20)) console.error(`  ${ruta} · ${motivo}`)
  if (diferencias.length > 20) console.error(`  ... y ${diferencias.length - 20} más`)
  console.error('Arréglalo con `pnpm openapi:generate`. Este comando no arregla nada.')
  process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
