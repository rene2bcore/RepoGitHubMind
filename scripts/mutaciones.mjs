/**
 * R-14: una comprobación cuenta cuando se la ha visto fallar.
 *
 * Hasta que existió este script, en el proyecto de origen se hacía a mano:
 * mutar, mirar el rojo, revertir, y escribir en un hallazgo que se había
 * hecho. Siete revisiones adversariales encontraron comprobaciones en verde
 * sobre mutaciones reales, y el mismo día que se escribió este fichero una
 * mutación a mano **no llegó a aplicarse** por el escapado del shell y dio un
 * verde que no probaba nada.
 *
 * Cada entrada del catálogo es un defecto que ya existió, reintroducido tal
 * cual, y las comprobaciones que dicen cubrirlo. Para cada una:
 *
 * 1. Las comprobaciones tienen que estar en **verde sin mutar**. Un rojo que ya
 *    estaba no demuestra nada.
 * 2. El texto a mutar tiene que aparecer **exactamente una vez**. Si el código
 *    cambió y ya no aparece, el catálogo está desfasado y eso es un fallo: una
 *    mutación que no se aplica es un verde falso.
 * 3. Con la mutación puesta, **todas** tienen que salir distinto de cero **y
 *    nombrar lo que se espera**: rojo por el motivo correcto, no por otro.
 * 4. El fichero vuelve a su contenido exacto, también si se interrumpe.
 *
 * Fuera del catálogo a propósito: cualquier mutación que, puesta, haga daño
 * real a quien la ejecuta (por ejemplo, apuntar la suite a la base de
 * desarrollo). Esas las vigila solo el verificador, que no ejecuta la suite.
 *
 * Uso: node scripts/mutaciones.mjs [id ...]     # todas, o las nombradas
 *      node scripts/mutaciones.mjs --listar
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------
// Comprobaciones: cómo se ejecuta cada una y cómo marca **una línea de fallo**.
//
// No basta con que la salida contenga el motivo: el verificador imprime el
// nombre de todas sus comprobaciones, también las que pasan, así que un rojo
// de otra cualquiera habría dado por buena la entrada. El motivo tiene que
// estar en una línea que diga que eso falló.
//
// `args` se ejecuta con `process.execPath` (node) para no depender del PATH
// ni del shell. Para un runner que no sea node, usa `programa`.
// ---------------------------------------------------------------------------

// pnpm es un `.cmd` en Windows, y Node se niega a lanzar un `.cmd` sin shell
// desde la corrección de seguridad de 2024. Las comprobaciones que pasan por
// pnpm declaran `programa` y el motor lo lanza con shell solo en Windows.
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

/**
 * Las pruebas de Vitest filtradas por fichero, sobre el workspace entero.
 * Vitest marca la prueba fallida con `×` o con `FAIL` al principio de línea.
 */
const pruebas = (filtro) => ({
  nombre: `vitest: ${filtro}`,
  cwd: '.',
  programa: PNPM,
  args: ['vitest', 'run', filtro],
  fallo: /^\s*(×|FAIL\s)/,
})
const VERIFICADOR = {
  nombre: 'verificar-docs',
  cwd: '.',
  args: ['scripts/verificar-docs.mjs'],
  fallo: /^FALLA\b/,
}
const CONTRATO = {
  nombre: 'openapi:check',
  cwd: '.',
  programa: PNPM,
  args: ['openapi:check'],
  fallo: /(falta|sobra) en el fichero|valor distinto/,
}
const PLAYWRIGHT = {
  nombre: 'playwright',
  cwd: '.',
  programa: PNPM,
  args: ['test:e2e'],
  // La cabecera del detalle, `1) [chromium] › …`, es igual en Windows y Linux
  // y solo sale cuando algo falla.
  fallo: /^\s*\d+\) \[chromium\]/,
}
const FORMATO = {
  nombre: 'format:check',
  cwd: '.',
  programa: PNPM,
  args: ['format:check'],
  fallo: /^\[warn\]\s/,
}
const HOOK = {
  nombre: 'probar-hook-rama',
  cwd: '.',
  args: ['scripts/probar-hook-rama.mjs'],
  fallo: /^FALLA\b/,
}
const MENSAJE = {
  nombre: 'probar-hook-mensaje',
  cwd: '.',
  args: ['scripts/probar-hook-mensaje.mjs'],
  fallo: /^FALLA\b/,
}
const FIX = {
  nombre: 'probar-fix-con-prueba',
  cwd: '.',
  args: ['scripts/probar-fix-con-prueba.mjs'],
  fallo: /^FALLA\b/,
}
// ---------------------------------------------------------------------------
// El catálogo.
//
// Una entrada por cada defecto real que se haya arreglado, con el id de su
// hallazgo o ADR. Las cuatro primeras mutan ficheros del propio harness y
// muerden desde el primer push, sin código. Las de producto llegan con cada
// historia: el flujo principal, el aislamiento de la base, la fuga de datos
// personales entre cuentas. Los ejemplos comentados enseñan la forma.
// ---------------------------------------------------------------------------

const CATALOGO = [
  {
    id: 'R-01',
    que: 'el hook de rama deja de rechazar main',
    fichero: '.githooks/pre-commit',
    cambios: [['  main)', '  rama-que-no-existe)']],
    muerden: [[HOOK, 'main · aceptado']],
  },
  {
    id: 'commit-msg',
    que: 'el hook de mensaje deja de rechazar',
    fichero: '.githooks/commit-msg',
    cambios: [['  exit 1', '  exit 0']],
    muerden: [[MENSAJE, 'arreglo el bug']],
  },
  {
    id: 'R-08',
    que: 'la comprobación de R-08 deja de reconocer un fix con ruptura',
    fichero: 'scripts/fix-con-prueba.mjs',
    cambios: [['/^fix(\\([^)]*\\))?!?:/', '/^fix(\\([^)]*\\))?:/']],
    muerden: [[FIX, 'fix(tasks)!: sin prueba y rompiendo']],
  },
  {
    id: 'R-06',
    que: 'una tubería de CI vuelve a tapar el código de salida de la suite',
    fichero: '.github/workflows/verificacion.yml',
    cambios: [
      [
        '          set -o pipefail\n          pnpm test 2>&1 | tee salida-pruebas.txt\n          node scripts/recuento-pruebas.mjs monorepo',
        '          pnpm test 2>&1 | tee salida-pruebas.txt\n          node scripts/recuento-pruebas.mjs monorepo',
      ],
    ],
    muerden: [[VERIFICADOR, 'Toda tubería de un workflow declara pipefail']],
  },
  {
    id: 'rutas-documentadas',
    que: 'una ruta desaparece de la tabla de CLAUDE.md sin salir del contrato',
    fichero: 'CLAUDE.md',
    cambios: [['| GET    | `/api/v1/auth/me`       | sí   |\n', '']],
    muerden: [[VERIFICADOR, 'La tabla de rutas de CLAUDE.md corresponde con el contrato']],
  },
  {
    id: 'ruta-protegida-publica',
    que: 'el contrato declara pública una ruta que exige sesión',
    fichero: 'docs/api/openapi.json',
    cambios: [
      [
        '"/api/v1/auth/me": {\n      "get": {\n        "summary": "La cuenta de la sesión presentada",',
        '"/api/v1/auth/me": {\n      "get": {\n        "security": [],\n        "summary": "La cuenta de la sesión presentada",',
      ],
    ],
    muerden: [
      [
        VERIFICADOR,
        'El contrato no repite ningún parámetro ni deja sin seguridad una operación protegida',
      ],
    ],
  },
  {
    id: 'ADR-0003',
    que: 'la suite vuelve a apuntar a la base de desarrollo',
    fichero: 'packages/db/src/client.ts',
    cambios: [
      [
        "const url = env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL",
        "const url = env.NODE_ENV === 'test' ? env.DATABASE_URL : env.DATABASE_URL",
      ],
    ],
    muerden: [[VERIFICADOR, 'Las pruebas no pueden escribir sobre la base de desarrollo']],
  },
  {
    id: 'ADR-0004',
    que: 'un 500 vuelve a salir con el mensaje del error, que en la base es la sentencia SQL',
    fichero: 'apps/web/src/lib/http.ts',
    cambios: [['      const debug = readEnv().DEBUG_HTTP_ERRORS\n', '      const debug = true\n']],
    muerden: [
      [VERIFICADOR, 'El volcado de depuración va apagado salvo que se encienda'],
      [pruebas('errores'), 'un 5xx responde la forma cerrada sin el mensaje de la excepción'],
    ],
  },
  {
    id: 'ADR-0005',
    que: 'una carrera de altas con el mismo email responde 500 en vez de 422',
    fichero: 'apps/web/src/modules/auth/service.ts',
    cambios: [['    if (isUniqueViolation(error)) throw new ValidationError([EMAIL_TAKEN])\n', '']],
    muerden: [
      [pruebas('auth'), 'la carrera de altas la para el índice único y responde 422, no 500'],
    ],
  },
  // Con H3 (RGM-4) entra la mutación de la vertical entera, la única que
  // recorre el flujo principal: la biblioteca deja de ser privada y cada
  // cuenta ve las de todas. Muerde la prueba con dos cuentas y Playwright.
]

// ---------------------------------------------------------------------------
// El motor. No hace falta tocarlo.
// ---------------------------------------------------------------------------

const sinColor = (texto) => texto.replace(/\x1b\[[0-9;]*m/g, '')
const lineas = (texto) => texto.split(/\r?\n/)

/**
 * Cuando algo no casa, la salida entera de lo que se ejecutó. Sin ella, un
 * «rojo por otro motivo» en CI solo se puede adivinar.
 */
function volcar(salida) {
  const resto = lineas(salida).filter((l) => l.trim())
  for (const l of resto.slice(-60)) console.log(`    | ${l}`)
}

function ejecutar({ cwd, args, programa }) {
  const r = spawnSync(programa ?? process.execPath, args, {
    cwd: join(RAIZ, cwd),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // Solo para `.cmd` en Windows; con `node` no hace falta shell y evitarlo
    // impide que un argumento con espacios se reinterprete.
    shell: Boolean(programa) && process.platform === 'win32',
    // Sin el resumen del job: el verificador escribe en él, y aquí se ejecuta
    // una vez por mutación.
    env: { ...process.env, FORCE_COLOR: '0', GITHUB_STEP_SUMMARY: '' },
  })
  return { status: r.status, salida: sinColor(`${r.stdout ?? ''}${r.stderr ?? ''}`) }
}

if (process.argv.includes('--listar')) {
  for (const m of CATALOGO) {
    console.log(`${m.id.padEnd(22)} ${m.que} · ${m.muerden.map(([c]) => c.nombre).join(', ')}`)
  }
  process.exit(0)
}

const pedidos = process.argv.slice(2)
const elegidas = pedidos.length ? CATALOGO.filter((m) => pedidos.includes(m.id)) : CATALOGO
const desconocidos = pedidos.filter((id) => !CATALOGO.some((m) => m.id === id))
if (desconocidos.length) {
  console.error(`No están en el catálogo: ${desconocidos.join(', ')}`)
  process.exit(2)
}
if (!elegidas.length) {
  console.error(
    'El catálogo está vacío. Cada comprobación que añadas necesita su entrada aquí (R-14).',
  )
  process.exit(1)
}

const originales = new Map()
function restaurarTodo() {
  for (const [ruta, contenido] of originales) writeFileSync(ruta, contenido)
}
process.on('SIGINT', () => {
  restaurarTodo()
  process.exit(130)
})

const fallos = []

// 1. Verde sin mutar, una vez por comprobación distinta.
const base = new Map()
for (const [comprobacion] of elegidas.flatMap((m) => m.muerden)) {
  if (base.has(comprobacion.nombre)) continue
  const { status, salida } = ejecutar(comprobacion)
  base.set(comprobacion.nombre, status === 0)
  console.log(`${status === 0 ? 'verde' : 'ROJO '} sin mutar · ${comprobacion.nombre}`)
  if (status !== 0) {
    fallos.push(`${comprobacion.nombre} ya está en rojo sin mutar nada`)
    volcar(salida)
  }
}
if (fallos.length) {
  console.error(`\n${fallos.join('\n')}\nSin un verde de partida, ningún rojo demuestra nada.`)
  process.exit(1)
}

// 2 y 3. Cada mutación, aplicada exactamente, y cada comprobación en rojo por su motivo.
for (const m of elegidas) {
  const ruta = join(RAIZ, m.fichero)
  const original = readFileSync(ruta, 'utf8')
  const eol = original.includes('\r\n') ? '\r\n' : '\n'
  const conEol = (texto) => texto.replace(/\r?\n/g, eol)

  let mutado = original
  const noAplica = []
  for (const [de, a] of m.cambios) {
    const buscado = conEol(de)
    const veces = mutado.split(buscado).length - 1
    if (veces !== 1) noAplica.push(`aparece ${veces} veces: ${de.split('\n')[0].trim()}`)
    else mutado = mutado.replace(buscado, () => conEol(a))
  }
  if (noAplica.length) {
    fallos.push(`${m.id}: el catálogo ya no corresponde con ${m.fichero} (${noAplica.join('; ')})`)
    console.log(`\nNO APLICA ${m.id} · ${noAplica.join('; ')}`)
    continue
  }

  console.log(`\n${m.id} · ${m.que}`)
  originales.set(ruta, original)
  writeFileSync(ruta, mutado)
  try {
    for (const [comprobacion, motivo] of m.muerden) {
      const { status, salida } = ejecutar(comprobacion)
      if (status === 0) {
        fallos.push(`${m.id}: ${comprobacion.nombre} sigue en verde con la mutación puesta`)
        console.log(`  SOBREVIVE ${comprobacion.nombre}`)
      } else if (!lineas(salida).some((l) => comprobacion.fallo.test(l) && l.includes(motivo))) {
        fallos.push(
          `${m.id}: ${comprobacion.nombre} sale en rojo, pero ninguna línea de fallo nombra «${motivo}»`,
        )
        console.log(`  ROJO POR OTRO MOTIVO ${comprobacion.nombre}`)
        volcar(salida)
      } else {
        console.log(`  muerde ${comprobacion.nombre} · ${motivo}`)
      }
    }
  } finally {
    writeFileSync(ruta, original)
    originales.delete(ruta)
    if (readFileSync(ruta, 'utf8') !== original) {
      console.error(`NO SE PUDO RESTAURAR ${m.fichero}`)
      process.exit(3)
    }
  }
}

const total = elegidas.reduce((n, m) => n + m.muerden.length, 0)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    fallos.length
      ? `### Mutaciones: ${fallos.length} problemas\n\n${fallos.map((f) => `- ${f}`).join('\n')}\n`
      : `### Mutaciones: ${elegidas.length} mutaciones, ${total} comprobaciones en rojo por su motivo\n`,
  )
}

if (fallos.length) {
  console.error(`\n${fallos.length} problemas:\n- ${fallos.join('\n- ')}`)
  process.exit(1)
}
console.log(
  `\n${elegidas.length} mutaciones, ${total} comprobaciones en rojo por su motivo, todo restaurado.`,
)
