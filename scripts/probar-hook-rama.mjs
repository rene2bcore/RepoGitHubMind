/**
 * Prueba de `.githooks/pre-commit`, que baja R-01 a algo que se ejecuta:
 * nunca commitear directo en `main` ni en una rama protegida.
 *
 * El hook corre en la máquina de quien commitea, así que CI no puede ver si
 * está activado ahí. Lo que sí puede ver es que **decide bien**, y eso es lo
 * que se rompe en silencio: un patrón mal escrito, o el bit de ejecución
 * perdido -Git ignora un hook que no es ejecutable, y en Windows no se nota
 * porque ahí no se mira ese bit-.
 *
 * Monta un repositorio desechable, le apunta `core.hooksPath` al directorio
 * del proyecto, y commitea en cada rama esperando el código de salida. El
 * commit base se crea con `commit-tree`, que no pasa por hooks. El asunto es
 * convencional porque `commit-msg` también corre aquí.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOKS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.githooks')

// Los casos tienen que
// corresponder con el `case` de `.githooks/pre-commit`. Si proteges también
// `develop` o `release/*`, añade aquí un caso con `permitido: false` por cada
// una, o el hook podría protegerlas mal sin que nada lo diga.
const CASOS = [
  { rama: 'main', permitido: false },
  { rama: 'feat/una-unidad', permitido: true },
  { rama: 'feature/entrega-1-XX', permitido: true },
  { rama: 'final-project-XX', permitido: true },
  { rama: 'docs/main/notas', permitido: true },
  {
    rama: null,
    permitido: true,
    nombre: 'HEAD desacoplado, que es como trabaja un rebase',
  },
]

const repo = mkdtempSync(join(tmpdir(), 'hook-rama-'))
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()

let fallos = 0
try {
  git('init', '-q')
  git('config', 'user.name', 'prueba')
  git('config', 'user.email', 'prueba@example.com')
  git('config', 'core.hooksPath', HOOKS)
  git('update-ref', 'refs/heads/base', git('commit-tree', git('write-tree'), '-m', 'base'))

  for (const { rama, permitido, nombre } of CASOS) {
    if (rama === null) git('checkout', '-q', '--detach', 'base')
    else git('checkout', '-q', '-B', rama, 'base')

    const { status } = spawnSync('git', ['commit', '--allow-empty', '-q', '-m', 'test: prueba'], {
      cwd: repo,
      encoding: 'utf8',
    })
    const aceptado = status === 0
    const bien = aceptado === permitido
    if (!bien) fallos++
    console.log(
      `${bien ? 'OK   ' : 'FALLA'} ${nombre ?? rama} · ${aceptado ? 'aceptado' : 'rechazado'}, se esperaba ${permitido ? 'aceptado' : 'rechazado'}`,
    )
  }
} finally {
  rmSync(repo, { recursive: true, force: true })
}

if (fallos) {
  console.error(`\n${fallos} de ${CASOS.length} casos no deciden lo que R-01 exige.`)
  process.exit(1)
}
console.log(`\nEl hook de rama decide bien en los ${CASOS.length} casos.`)
