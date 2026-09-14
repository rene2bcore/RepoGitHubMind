/**
 * El número de pruebas que dice CLAUDE.md, contra el que da el runner.
 *
 * En el proyecto de origen el recuento estuvo copiado en seis documentos y
 * cada prueba nueva obligaba a tocarlos todos a mano; ninguna comprobación lo
 * miraba. Ahora vive solo en CLAUDE.md, y esto lo contrasta con la salida
 * real de Vitest sobre el workspace entero.
 *
 * No se cuenta leyendo los ficheros: un `test(` con el título en la línea
 * siguiente, o uno generado en un bucle, no casa con ninguna expresión
 * regular razonable. Se lee la línea resumen del runner.
 *
 * Uso: node scripts/recuento-pruebas.mjs monorepo <salida de pnpm test>
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const [lado, fichero] = process.argv.slice(2)
if (lado !== 'monorepo' || !fichero) {
  console.error('Uso: node scripts/recuento-pruebas.mjs monorepo <salida del runner>')
  process.exit(2)
}

const sinColor = (texto) => texto.replace(/\x1b\[[0-9;]*m/g, '')
const salida = sinColor(readFileSync(fichero, 'utf8'))
const claude = readFileSync(join(RAIZ, 'CLAUDE.md'), 'utf8')

/**
 * En CI, el resultado va también al resumen del job: un número que solo está
 * en el log no lo lee nadie que mire el PR.
 */
function resumir(linea) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${linea}\n`)
}

function fallar(mensaje) {
  console.error(`recuento de pruebas (${lado}): ${mensaje}`)
  resumir(`**Pruebas: en rojo.** ${mensaje}`)
  process.exit(1)
}

// Vitest cierra con «Tests  84 passed (84)», con el total entre paréntesis
// aunque haya fallos u omitidas. Con varios proyectos del workspace, la última
// línea «Tests» es la agregada.
const resumenes = [...salida.matchAll(/Tests\s+[^\n(]*\((\d+)\)/g)]
if (!resumenes.length) fallar('la salida del runner no trae la línea de resumen «Tests ... (N)»')
const ejecutadas = Number(resumenes.at(-1)[1])

// Los números de un desglose, sin los identificadores de hallazgo ni de ADR.
const partes = (texto) => (texto.replace(/(H|ADR|RGM)-\d+/g, '').match(/\b\d+\b/g) ?? []).map(Number)

// La frase de CLAUDE.md: «Hoy hay **N pruebas** en el monorepo: <desglose>.»
// El total tiene que cuadrar con el desglose, o una prueba añadida sin tocar
// el desglose pasaría.
const total = claude.match(/Hoy hay \*\*(\d+) pruebas\*\* en el monorepo: ([^.]*)\./)
if (!total) fallar('CLAUDE.md ya no dice «Hoy hay **N pruebas** en el monorepo: <desglose>.»')
const citadas = Number(total[1])
const sumandos = partes(total[2])
const suma = sumandos.reduce((a, b) => a + b, 0)
if (suma !== citadas) {
  fallar(`CLAUDE.md dice ${citadas} pruebas pero su desglose suma ${suma} (${sumandos.join(' + ')})`)
}

if (citadas !== ejecutadas) {
  fallar(`CLAUDE.md dice ${citadas} y el runner ejecutó ${ejecutadas}. Actualiza CLAUDE.md.`)
}
console.log(`recuento de pruebas: CLAUDE.md dice ${citadas}, el runner ejecutó ${ejecutadas}`)
resumir(`**Pruebas: ${ejecutadas} ejecutadas**, y CLAUDE.md dice las mismas.`)
