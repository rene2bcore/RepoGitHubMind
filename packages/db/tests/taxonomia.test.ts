import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  categories,
  closeDb,
  databaseUrlForEnv,
  flattenTaxonomy,
  getDb,
  seedTaxonomy,
} from '../src'
import { truncateAllTables } from '../src/migrate'

/**
 * specs/ai · «Categorías del catálogo»: el catálogo es el de
 * `docs/taxonomy.md` y el seed lo escribe igual en todos los entornos. El
 * documento es el seed declarado; si el árbol o los sinónimos de aquí y los
 * del documento divergen, esta prueba lo dice.
 */
function documento() {
  const texto = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'taxonomy.md'), 'utf8')
  const bloque = texto.split('## Catálogo inicial (seed)')[1]?.split('```text')[1]?.split('```')[0]
  if (!bloque) throw new Error('docs/taxonomy.md ya no tiene el bloque del catálogo')
  const pila: string[] = []
  const arbol: { path: string; name: string }[] = []
  for (const linea of bloque.split('\n')) {
    const m = linea.match(/^([│├└─\s]*?)([a-z0-9-]+)\s{2,}(\S.*)$/)
    if (!m) continue
    const profundidad = m[1]!.length / 4
    pila.length = profundidad
    pila.push(m[2]!)
    arbol.push({ path: pila.join('/'), name: m[3]!.trim() })
  }
  const sinonimos = new Map<string, string[]>()
  const tabla = texto.split('## Sinónimos para el mapeo')[1] ?? ''
  for (const fila of tabla.split('\n')) {
    const celdas = fila.split('|').map((c) => c.trim())
    if (celdas.length < 4 || !celdas[2]?.startsWith('`')) continue
    const terminos = [...celdas[1]!.matchAll(/`([^`]+)`/g)].map((x) => x[1]!)
    sinonimos.set(celdas[2].replace(/`/g, ''), terminos)
  }
  return { arbol, sinonimos }
}

describe('taxonomía', () => {
  beforeAll(() => truncateAllTables(databaseUrlForEnv()))
  afterAll(() => closeDb())

  it('el catálogo del seed es el árbol y los sinónimos de docs/taxonomy.md', () => {
    const { arbol, sinonimos } = documento()
    const catalogo = flattenTaxonomy()
    expect(catalogo.map((c) => ({ path: c.path, name: c.name }))).toEqual(arbol)
    const conSinonimos = new Map(
      catalogo.filter((c) => c.synonyms.length).map((c) => [c.path, c.synonyms]),
    )
    expect(conSinonimos).toEqual(sinonimos)
  })

  it('sembrar dos veces deja el mismo catálogo, con cada hija colgando de su padre', async () => {
    const db = getDb()
    const total = flattenTaxonomy().length
    expect(await seedTaxonomy(db)).toBe(total)
    expect(await seedTaxonomy(db)).toBe(total)
    const [filas] = await db.select({ n: count() }).from(categories)
    expect(filas?.n).toBe(total)

    const [vector] = await db.select().from(categories).where(eq(categories.slug, 'vector'))
    const [databases] = await db.select().from(categories).where(eq(categories.slug, 'databases'))
    expect(vector).toMatchObject({ path: 'data/databases/vector', depth: 2 })
    expect(vector?.parentId).toBe(databases?.id)
    expect(vector?.synonyms).toContain('similarity search')
  })
})
