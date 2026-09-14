/**
 * Prueba de `scripts/fix-con-prueba.mjs`, la comprobación de R-08.
 *
 * Una comprobación que decide sobre mensajes de commit falla en silencio de
 * dos formas: dejando pasar un `fix:` sin prueba -por un patrón que no
 * reconoce `fix(ambito)!:`, por ejemplo- o bloqueando lo que no es un arreglo.
 * Cada caso es un commit en un repositorio desechable, y se comprueba el
 * código de salida de la comprobación sobre ese commit solo.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const COMPROBACION = resolve(dirname(fileURLToPath(import.meta.url)), 'fix-con-prueba.mjs')

const CASOS = [
  { mensaje: 'fix: con su prueba en web', fichero: 'apps/web/src/lib/api.test.ts', pasa: true },
  {
    mensaje: 'fix(worker): con su prueba',
    fichero: 'apps/worker/src/jobs/refresh.spec.ts',
    pasa: true,
  },
  {
    mensaje: 'fix(db): con su prueba en un paquete',
    fichero: 'packages/db/tests/aislamiento.test.ts',
    pasa: true,
  },
  { mensaje: 'fix: prueba de navegador', fichero: 'apps/web/e2e/flujo.e2e.ts', pasa: true },
  { mensaje: 'fix: una comprobacion nueva', fichero: 'scripts/verificar-docs.mjs', pasa: true },
  { mensaje: 'fix: una mutacion nueva', fichero: 'scripts/mutaciones.mjs', pasa: true },
  { mensaje: 'fix: sin prueba', fichero: 'apps/web/src/lib/api.ts', pasa: false },
  {
    mensaje: 'fix(tasks)!: sin prueba y rompiendo',
    fichero: 'packages/github/src/provider.ts',
    pasa: false,
  },
  {
    mensaje: 'fix: un helper no es una prueba',
    fichero: 'apps/web/tests/helpers/api.ts',
    pasa: false,
  },
  {
    mensaje: 'fix: una fixture no es una prueba',
    fichero: 'apps/web/e2e/fixtures/cuenta.ts',
    pasa: false,
  },
  {
    mensaje: 'fix: el workflow\n\nSin-prueba: se vio en rojo y en verde en CI',
    fichero: '.github/workflows/x.yml',
    pasa: true,
  },
  {
    mensaje: 'fix: con la excusa vacia\n\nSin-prueba:',
    fichero: 'apps/web/src/lib/api.ts',
    pasa: false,
  },
  { mensaje: 'feat: no es un arreglo', fichero: 'apps/web/src/lib/api.ts', pasa: true },
  { mensaje: 'docs: fix: no es el asunto', fichero: 'docs/x.md', pasa: true },
]

const repo = mkdtempSync(join(tmpdir(), 'fix-con-prueba-'))
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()

let fallos = 0
try {
  git('init', '-q')
  git('config', 'user.name', 'prueba')
  git('config', 'user.email', 'prueba@example.com')
  git('config', 'core.hooksPath', join(repo, 'sin-hooks'))
  git('config', 'core.autocrlf', 'false')

  for (const [i, { mensaje, fichero, pasa }] of CASOS.entries()) {
    const ruta = join(repo, fichero)
    mkdirSync(dirname(ruta), { recursive: true })
    writeFileSync(ruta, `cambio ${i}\n`)
    git('add', fichero)
    git('commit', '-q', '-m', mensaje)

    const { status } = spawnSync('node', [COMPROBACION, 'HEAD^!'], { cwd: repo, encoding: 'utf8' })
    const paso = status === 0
    const bien = paso === pasa
    if (!bien) fallos++
    const asunto = mensaje.split('\n')[0]
    console.log(
      `${bien ? 'OK   ' : 'FALLA'} «${asunto}» en ${fichero} · ${paso ? 'pasa' : 'se rechaza'}, se esperaba que ${pasa ? 'pasara' : 'se rechazara'}`,
    )
  }
} finally {
  rmSync(repo, { recursive: true, force: true })
}

if (fallos) {
  console.error(`\n${fallos} de ${CASOS.length} casos no deciden lo que R-08 exige.`)
  process.exit(1)
}
console.log(`\nLa comprobación de R-08 decide bien en los ${CASOS.length} casos.`)
