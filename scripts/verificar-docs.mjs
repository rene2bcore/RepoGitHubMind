#!/usr/bin/env node
/**
 * Contrasta la documentación viva contra el código.
 *
 * No genera nada: comprueba. La diferencia importa, porque un generador
 * produce documentos que nadie lee y que quedan bien aunque el código haga
 * otra cosa; esto falla cuando el documento y el código dejan de coincidir,
 * que es el único momento en que el documento importa.
 *
 * Se ejecuta con `node scripts/verificar-docs.mjs` y en CI. Sale con código 1
 * si encuentra una discrepancia, para que rompa la build en vez de avisar en un
 * log que nadie mira.
 *
 * Dos clases de comprobación:
 *
 * - Las **genéricas**, que vienen con el harness y valen para cualquier
 *   proyecto: placeholders sin rellenar, enlaces del README, AGENTS.md,
 *   pipefail en los workflows, trazabilidad con filas, ADRs con sus
 *   secciones, .env.example sin secretos, rutas de CLAUDE.md contra el
 *   contrato.
 * - Las **específicas del proyecto**, que se añaden abajo cuando hay un
 *   defecto real que prevenir, y no antes. Cada una cita el hallazgo o el ADR
 *   del que sale.
 *
 * Y una regla que no se negocia (R-14): toda comprobación que se añada aquí
 * se demuestra mutando el código a propósito y viendo que se pone en rojo
 * **por ese motivo**, y se registra en `scripts/mutaciones.mjs`. Una
 * comprobación que no se ha visto fallar no cuenta.
 */
import { appendFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
const comprobaciones = []

const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8')

/**
 * Lee un fichero con los comentarios fuera.
 *
 * No es cosmética. En el proyecto de origen, cuatro comprobaciones se
 * satisfacían con un comentario: bastaba dejar el nombre de una función en un
 * JSDoc para que el verificador diera luz verde sobre código que hacía lo
 * contrario. Una comprobación que un comentario puede satisfacer no comprueba
 * nada.
 *
 * Viene para
 * JS/TS (`/* *\/` y `//`). Para Python, añade `.replace(/(^|[^'"])#.*$/gm, '$1')`
 * y las docstrings.
 */
const leerCodigo = (ruta) =>
  leer(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

function comprobar(nombre, fn) {
  try {
    const detalle = fn()
    comprobaciones.push({ nombre, ok: true, detalle })
  } catch (error) {
    comprobaciones.push({ nombre, ok: false, detalle: error.message })
    problemas.push(`${nombre}: ${error.message}`)
  }
}

/** Ficheros versionados, preguntados a git y no recorriendo el disco. */
function ficherosVersionados() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Genéricas
// ---------------------------------------------------------------------------

comprobar('No queda ningún placeholder del harness sin rellenar', () => {
  // El harness llega con marcas `[PON AQUÍ: ...]`. Una que se quede es un
  // fichero a medio configurar con apariencia de terminado: un workflow con
  // un comando inventado, un hook que protege una rama que no existe.
  // Se excluye este script y PLACEHOLDERS.md, que documentan la marca.
  const marca = /\[PON AQU[IÍ]:/
  const excluidos = new Set(['scripts/verificar-docs.mjs', 'PLACEHOLDERS.md'])
  const conMarca = []
  for (const fichero of ficherosVersionados()) {
    if (excluidos.has(fichero)) continue
    if (/\.(png|jpg|jpeg|gif|ico|pdf|woff2?|zip|sqlite3)$/i.test(fichero)) continue
    const ruta = join(RAIZ, fichero)
    if (!existsSync(ruta) || statSync(ruta).isDirectory()) continue
    const texto = readFileSync(ruta, 'utf8')
    const lineas = texto.split('\n')
    lineas.forEach((linea, i) => {
      if (marca.test(linea)) conMarca.push(`${fichero}:${i + 1}`)
    })
  }
  if (conMarca.length) {
    throw new Error(`placeholders sin rellenar: ${conMarca.slice(0, 10).join(', ')}${conMarca.length > 10 ? ` y ${conMarca.length - 10} más` : ''}`)
  }
  return 'ninguno'
})

comprobar('AGENTS.md se puede leer en cualquier sistema', () => {
  // Era un symlink a `CLAUDE.md`, modo `120000` en el índice. Un symlink solo
  // se materializa donde el sistema lo permite: en Windows, con
  // `core.symlinks=false`, git escribe un fichero de texto cuyo contenido es
  // la cadena `CLAUDE.md`. Se comprueba el **modo en el índice**, no el
  // fichero del disco.
  const entrada = execFileSync('git', ['ls-files', '-s', 'AGENTS.md'], {
    cwd: RAIZ,
    encoding: 'utf8',
  }).trim()

  if (!entrada) throw new Error('AGENTS.md no está en el índice')

  const modo = entrada.split(/\s+/)[0]
  if (modo === '120000') {
    throw new Error('AGENTS.md ha vuelto a ser un symlink: en Windows se lee como texto suelto')
  }

  const contenido = leer('AGENTS.md')
  if (!contenido.includes('CLAUDE.md')) {
    throw new Error('AGENTS.md ya no apunta a CLAUDE.md')
  }

  return `modo ${modo}, apunta a CLAUDE.md`
})

comprobar('Los documentos que el README enlaza existen', () => {
  // Se derivan de los enlaces del README y no de una lista escrita a mano:
  // una lista a mano no falla cuando el README enlaza algo que no está.
  const readme = leer('README.md')
  const enlaces = [...readme.matchAll(/\]\((?!https?:|#|mailto:)([^)]+)\)/g)]
    .map((m) => m[1].split('#')[0].trim())
    .filter(Boolean)
    .map((ruta) => ruta.replace(/^\.\//, ''))

  const ausentes = [...new Set(enlaces)].filter((ruta) => !existsSync(join(RAIZ, ruta)))
  if (ausentes.length) throw new Error(`enlaces rotos: ${ausentes.join(', ')}`)

  // Los que tienen que existir siempre,
  // enlace o no: sin ellos el proyecto no se puede explicar ni verificar.
  const imprescindibles = [
    'CLAUDE.md',
    'REVIEW.md',
    'prompts.md',
    'docs/prd.md',
    'docs/architecture.md',
    'docs/data-model.md',
    'docs/traceability.md',
    'docs/hallazgos.md',
    'docs/api/openapi.json',
  ]
  const faltan = imprescindibles.filter((ruta) => !existsSync(join(RAIZ, ruta)))
  if (faltan.length) throw new Error(`faltan: ${faltan.join(', ')}`)

  return `${new Set(enlaces).size} enlaces del README`
})

comprobar('La matriz de trazabilidad tiene filas y cada fila sus columnas', () => {
  // Una matriz vacía o con filas a medias es la misma mentira que no tenerla:
  // dice que hay trazabilidad y no traza nada. Se exige la tabla con la
  // cabecera acordada y, en cada fila, las seis columnas. Las celdas pueden
  // ir en blanco («sin prueba», «no construido»): el hueco es información;
  // la fila corta, no.
  const texto = leer('docs/traceability.md')
  const cabecera = texto.match(/^\|\s*Ticket[^\n]*\|\s*Historia[^\n]*\|\s*Criterio[^\n]*\|\s*Spec[^\n]*\|\s*Prueba[^\n]*\|\s*C[oó]digo[^\n]*\|\s*$/m)
  if (!cabecera) {
    throw new Error('no se encuentra la cabecera `| Ticket | Historia | Criterio | Spec | Prueba | Código |`')
  }
  const desde = texto.indexOf(cabecera[0])
  // La tabla termina en la primera línea que no empieza por `|`: lo que venga
  // después son otras tablas, con otras columnas, y no cuentan aquí.
  const datos = []
  for (const l of texto.slice(desde).split('\n').slice(1)) {
    if (!/^\|/.test(l.trim())) break
    if (/^\|[\s|:-]+\|$/.test(l.trim())) continue
    datos.push(l)
  }
  if (!datos.length) throw new Error('la matriz no tiene ninguna fila')
  const cortas = datos.filter((l) => l.trim().split('|').length - 2 < 6)
  if (cortas.length) throw new Error(`${cortas.length} fila(s) con menos de seis columnas`)
  return `${datos.length} filas`
})

comprobar('Cada ADR tiene contexto, decisión, estado y consecuencias', () => {
  // Un ADR sin alternativas o sin consecuencias es una nota, no una decisión
  // registrada. Se exigen las secciones que hacen que el documento sirva
  // dentro de un año: qué había, qué se decidió, qué se descartó y qué cuesta.
  const directorio = join(RAIZ, 'docs/adr')
  if (!existsSync(directorio)) throw new Error('no existe docs/adr/')
  const adrs = readdirSync(directorio).filter((f) => /^\d{4}-.+\.md$/.test(f))
  if (!adrs.length) throw new Error('no hay ningún ADR numerado en docs/adr/')

  const requeridas = ['Estado', 'Contexto', 'Decisi', 'Alternativas', 'Consecuencias']
  const incompletos = []
  for (const f of adrs) {
    const texto = leer(`docs/adr/${f}`)
    const faltan = requeridas.filter((s) => !new RegExp(`^##+\\s+${s}`, 'm').test(texto))
    if (faltan.length) incompletos.push(`${f} (sin ${faltan.join(', ')})`)
  }
  if (incompletos.length) throw new Error(`ADRs incompletos: ${incompletos.join('; ')}`)
  return `${adrs.length} ADRs`
})

comprobar('Ningún .env.example trae un valor que parezca real', () => {
  // El `.env.example` es el fichero que copia todo el que llega. Un secreto
  // real ahí es un secreto versionado. Se buscan las formas de token que se
  // conocen y cualquier valor largo y opaco en una variable con nombre de
  // secreto.
  const ejemplos = ficherosVersionados().filter((f) => /(^|\/)\.env\.example$/.test(f))
  if (!ejemplos.length) return 'no hay .env.example'

  const sospechosos = []
  const formasDeToken = /(sk-ant-|ghp_|gho_|github_pat_|AKIA[0-9A-Z]{12,}|xox[bap]-|-----BEGIN )/
  for (const f of ejemplos) {
    for (const [i, linea] of leer(f).split('\n').entries()) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      const [, clave, valorCrudo] = m
      const valor = valorCrudo.replace(/^['"]|['"]$/g, '').trim()
      if (formasDeToken.test(valor)) sospechosos.push(`${f}:${i + 1} ${clave}`)
      else if (/(SECRET|TOKEN|PASSWORD|KEY|PRIVATE)/.test(clave) && /^[A-Za-z0-9+/=_-]{32,}$/.test(valor)) {
        sospechosos.push(`${f}:${i + 1} ${clave}`)
      }
    }
  }
  if (sospechosos.length) throw new Error(`valores que parecen reales: ${sospechosos.join(', ')}`)
  return `${ejemplos.length} ficheros`
})

comprobar('La tabla de rutas de CLAUDE.md corresponde con el contrato', () => {
  // CLAUDE.md es lo primero que lee quien llega al repositorio, y la tabla de
  // rutas es lo que más rápido se desactualiza. Se contrasta contra el
  // contrato versionado, que a su vez CI contrasta contra el código: si las
  // tres cosas coinciden, la tabla dice la verdad.
  //
  // Si tu framework da una forma de listar las rutas reales (por ejemplo
  // `node ace list:routes --json`), contrasta contra eso además: es más
  // fuerte que contra el contrato.
  const documentadas = new Set(
    [...leer('CLAUDE.md').matchAll(/^\|\s*(GET|POST|PATCH|PUT|DELETE)\s*\|\s*`([^`]+)`/gm)].map(
      (m) => `${m[1]} ${m[2].replace(/\{([^}]+)\}/g, ':$1')}`
    )
  )
  if (!documentadas.size) throw new Error('no se encuentra la tabla de rutas en CLAUDE.md')

  const contrato = JSON.parse(leer('docs/api/openapi.json'))
  const enContrato = new Set(
    Object.entries(contrato.paths ?? {}).flatMap(([ruta, ops]) =>
      Object.keys(ops)
        .filter((m) => /^(get|post|put|patch|delete)$/i.test(m))
        .map((m) => `${m.toUpperCase()} ${ruta.replace(/\{([^}]+)\}/g, ':$1')}`)
    )
  )
  if (!enContrato.size) throw new Error('el contrato no declara ninguna operación')

  const faltan = [...enContrato].filter((r) => !documentadas.has(r))
  const sobran = [...documentadas].filter((r) => !enContrato.has(r))
  if (faltan.length) throw new Error(`sin documentar en CLAUDE.md: ${faltan.join(', ')}`)
  if (sobran.length) throw new Error(`en CLAUDE.md pero fuera del contrato: ${sobran.join(', ')}`)

  return `${enContrato.size} rutas`
})

comprobar('El contrato no repite ningún parámetro ni deja sin seguridad una operación protegida', () => {
  // OpenAPI exige que la pareja `name` + `in` sea única dentro de una
  // operación. Y `security: []` **no** es «no se ha dicho nada» sino «esta
  // ruta es pública»: en el origen, el contrato declaró públicas dos rutas
  // protegidas durante un día. Las rutas protegidas se declaran en CLAUDE.md
  // con «sí» en la columna Auth, y aquí se contrastan.
  const contrato = JSON.parse(leer('docs/api/openapi.json'))
  const protegidas = new Set(
    [...leer('CLAUDE.md').matchAll(/^\|\s*(GET|POST|PATCH|PUT|DELETE)\s*\|\s*`([^`]+)`\s*\|\s*s[ií]\s*\|/gim)].map(
      (m) => `${m[1].toUpperCase()} ${m[2].replace(/\{([^}]+)\}/g, ':$1')}`
    )
  )

  const repetidos = []
  const publicasQueNo = []
  for (const [ruta, operaciones] of Object.entries(contrato.paths ?? {})) {
    for (const [metodo, operacion] of Object.entries(operaciones)) {
      if (!/^(get|post|put|patch|delete)$/i.test(metodo)) continue
      const clave = `${metodo.toUpperCase()} ${ruta.replace(/\{([^}]+)\}/g, ':$1')}`
      const vistos = new Set()
      for (const { name, in: donde } of operacion.parameters ?? []) {
        const k = `${donde}:${name}`
        if (vistos.has(k)) repetidos.push(`${clave} -> ${k}`)
        vistos.add(k)
      }
      if (protegidas.has(clave)) {
        const seguridad = operacion.security ?? contrato.security ?? []
        if (!seguridad.length) publicasQueNo.push(clave)
      }
    }
  }
  if (repetidos.length) throw new Error(`parámetros repetidos: ${[...new Set(repetidos)].join(', ')}`)
  if (publicasQueNo.length) throw new Error(`el contrato las declara públicas: ${publicasQueNo.join(', ')}`)
  return `${protegidas.size} rutas protegidas con esquema de seguridad`
})

comprobar('Toda tubería de un workflow declara pipefail', () => {
  // R-06: se verifica por código de salida, nunca por la última línea. Una
  // tubería devuelve el código de su último comando, así que `npm test | tee`
  // sale 0 aunque la suite falle. En Actions, un `run:` sin `shell:` explícito
  // corre con `bash -e`, **sin** `pipefail`: la tubería tapa el rojo en
  // silencio.
  //
  // Se leen los workflows como texto estructurado por pasos: cada bloque
  // `run:` se recorta y se le quitan comentarios y cadenas entre comillas
  // antes de buscar la tubería, porque el `|` de un filtro de `jq` no es una
  // tubería del shell. Sin dependencia de un parser YAML a propósito: el
  // verificador corre desde la raíz, donde no hay `node_modules`.
  const directorio = join(RAIZ, '.github', 'workflows')
  if (!existsSync(directorio)) throw new Error('no existe .github/workflows/')
  const conTuberia = /(^|[^|])\|(?!\|)/
  const sinCadenas = (linea) =>
    linea
      .replace(/'[^']*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/(^|\s)#.*$/, '$1')

  let revisados = 0
  const sinPipefail = []
  for (const fichero of readdirSync(directorio).filter((f) => /\.ya?ml$/.test(f))) {
    const texto = leer(`.github/workflows/${fichero}`)
    // Con `shell: bash` explícito a nivel de workflow, Actions ya añade
    // `-o pipefail` en todos los pasos.
    if (/^\s*defaults:\s*\n\s*run:\s*\n\s*shell:\s*bash\s*$/m.test(texto)) continue
    const lineas = texto.split('\n')
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(/^(\s*)(?:-\s+)?run:\s*(\|[-+]?|>[-+]?)?\s*(.*)$/)
      if (!m) continue
      const sangria = m[1].length
      let cuerpo = m[3] ? [m[3]] : []
      if (m[2]) {
        cuerpo = []
        for (let j = i + 1; j < lineas.length; j++) {
          const l = lineas[j]
          if (l.trim() === '') {
            cuerpo.push('')
            continue
          }
          const s = l.match(/^\s*/)[0].length
          if (s <= sangria) break
          cuerpo.push(l)
        }
      }
      const run = cuerpo.join('\n')
      if (!cuerpo.map(sinCadenas).some((l) => conTuberia.test(l))) continue
      // Un `shell: bash` en el mismo paso también cubre.
      const pasoDesde = Math.max(0, i - 12)
      const contextoPaso = lineas.slice(pasoDesde, i + cuerpo.length + 4).join('\n')
      if (/^\s*shell:\s*bash\s*$/m.test(contextoPaso)) continue
      revisados++
      if (!/\bset\s+-[a-z]*o\s+pipefail\b|\bset\s+-o\s+pipefail\b/.test(run)) {
        sinPipefail.push(`${fichero}:${i + 1}`)
      }
    }
  }

  if (!revisados) throw new Error('no se encontró ningún paso con tubería: la lectura dejó de ver algo')
  if (sinPipefail.length) throw new Error(`sin pipefail: ${sinPipefail.join('; ')}`)
  return `${revisados} pasos con tubería, todos con pipefail`
})

comprobar('Cada hallazgo abierto dice cómo se reproduce y qué lo vigila', () => {
  // Un hallazgo sin reproducción es una sospecha; uno sin vigilante vuelve
  // solo. En el origen volvieron nueve al cambiar de rama. Se exige que cada
  // entrada `## H-nn` lleve las dos líneas, y que las cerradas digan en qué
  // rama o commit se cerraron.
  const texto = leer('docs/hallazgos.md')
  const entradas = texto.split(/^## (?=H-\d+)/m).slice(1)
  if (!entradas.length) return 'sin hallazgos todavía'
  const incompletos = []
  for (const e of entradas) {
    const id = e.match(/^H-\d+/)[0]
    const faltan = []
    if (!/\*\*Reproducci[oó]n:?\*\*/i.test(e)) faltan.push('Reproducción')
    if (!/\*\*Qu[eé] lo vigila:?\*\*/i.test(e)) faltan.push('Qué lo vigila')
    if (!/\*\*Estado:?\*\*/i.test(e)) faltan.push('Estado')
    if (faltan.length) incompletos.push(`${id} (sin ${faltan.join(', ')})`)
  }
  if (incompletos.length) throw new Error(`hallazgos incompletos: ${incompletos.join('; ')}`)
  return `${entradas.length} hallazgos`
})

// ---------------------------------------------------------------------------
// Comprobaciones específicas del proyecto
//
// Se añaden cuando hay un defecto real que prevenir, citando el hallazgo o el
// ADR, y **con su entrada en scripts/mutaciones.mjs**. Dos ejemplos de la
// forma, tomados del proyecto de origen y comentados porque no aplican aquí:
//
// comprobar('Las pruebas no pueden escribir sobre la base de desarrollo', () => {
//   // ADR-0003. Se exige que la elección del fichero dependa del entorno y
//   // que la conexión use esa variable; comprobar solo que la cadena aparece
//   // lo satisfacía un comentario, y comprobar solo que existe el fichero de
//   // test lo satisfacía una constante muerta.
//   const config = leerCodigo('backend/config/database.ts')
//   const eleccion = config.match(/const\s+(\w+)\s*=\s*app\.inTest\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/)
//   if (!eleccion) throw new Error('config/database.ts no elige el fichero según el entorno')
//   const [, variable, enTest, fuera] = eleccion
//   if (enTest === fuera) throw new Error('el fichero de test y el de desarrollo son el mismo')
//   if (!new RegExp(`filename:\\s*app\\.tmpPath\\(${variable}\\)`).test(config)) {
//     throw new Error(`la conexión no usa \`${variable}\``)
//   }
//   return `${enTest} en test, ${fuera} fuera`
// })
//
// comprobar('El volcado de depuración va apagado salvo que se encienda', () => {
//   // ADR-0004. El valor tiene que ser **exactamente** la expresión que
//   // decide el ADR: una lista negra («ni true, ni inProduction») la pasaba
//   // `env.get(...) || !app.inTest` dejando el volcado encendido.
//   const handler = leerCodigo('backend/app/exceptions/handler.ts')
//   const debug = handler.match(/protected debug = (.+)/)
//   if (!debug) throw new Error('el handler no declara `debug`')
//   const valor = debug[1].trim().replace(/;$/, '')
//   if (valor !== "env.get('DEBUG_HTTP_ERRORS', false)") {
//     throw new Error(`\`debug\` vale \`${valor}\`, y debe ser env.get('DEBUG_HTTP_ERRORS', false)`)
//   }
//   return 'apagado'
// })
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

for (const { nombre, ok, detalle } of comprobaciones) {
  console.log(`${ok ? 'OK  ' : 'FALLA'}  ${nombre}${detalle ? ` · ${detalle}` : ''}`)
}

// En CI, la tabla va también al resumen del job: un «FALLA» que solo está en
// el log obliga a abrirlo para saber qué pasó.
if (process.env.GITHUB_STEP_SUMMARY) {
  const celda = (texto) =>
    String(texto ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ')
  const filas = [...comprobaciones].sort((a, b) => Number(a.ok) - Number(b.ok))
  const titulo = problemas.length ? `${problemas.length} en rojo` : 'todo en verde'
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `### Documentación contra código: ${titulo}`,
      '',
      '| | Comprobación | Detalle |',
      '|---|---|---|',
      ...filas.map((c) => `| ${c.ok ? 'OK' : '**FALLA**'} | ${celda(c.nombre)} | ${celda(c.detalle)} |`),
      '',
    ].join('\n')
  )
}

if (problemas.length) {
  console.error(`\n${problemas.length} discrepancia(s) entre la documentación y el código.`)
  process.exit(1)
}

console.log('\nLa documentación corresponde con el código.')
