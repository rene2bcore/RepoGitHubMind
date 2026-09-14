/**
 * Recorta un README a `max` caracteres conservando lo que más dice de un
 * repositorio (specs/ai · «README enorme»): la cabecera (título e
 * introducción) y las secciones de instalación y uso, y con lo que sobre, el
 * resto en su orden. Las secciones se devuelven en el orden del original.
 *
 * Antes de medir quita comentarios HTML y líneas que solo tienen insignias,
 * que ocupan presupuesto y no dicen nada. Un `#` dentro de un bloque de
 * código no abre sección.
 */
const PRIORITY =
  /\b(install|installation|installing|setup|getting started|quick ?start|usage|how to use|examples?|instalaci[oó]n|instalar|uso|primeros pasos|c[oó]mo usar)\b/i
const CUT = '\n[…]\n'

type Section = { heading: string; text: string }

export function truncateReadme(readme: string, max: number): string {
  const clean = readme
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*(?:\[?!\[[^\]]*\]\([^)]*\)(?:\]\([^)]*\))?[ \t]*)+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (clean.length <= max) return clean

  const sections = splitSections(clean)
  const [header, ...rest] = sections
  if (!header) return clean.slice(0, max)
  const chosen = new Map<Section, string>()
  let budget = max
  const take = (section: Section, limit: number) => {
    const text =
      section.text.length <= limit
        ? section.text
        : `${section.text.slice(0, Math.max(0, limit - CUT.length))}${CUT}`
    chosen.set(section, text)
    budget -= text.length
  }

  const priority = rest.filter((s) => PRIORITY.test(s.heading))
  take(header, priority.length ? Math.min(budget, Math.floor(max / 3)) : budget)
  priority.forEach((section, i) => {
    if (budget > CUT.length) take(section, Math.floor(budget / (priority.length - i)))
  })
  for (const section of rest) {
    if (chosen.has(section) || budget <= CUT.length) continue
    take(section, budget)
  }
  return sections
    .filter((s) => chosen.has(s))
    .map((s) => chosen.get(s))
    .join('')
    .slice(0, max)
}

/** Parte por encabezados Markdown fuera de bloques de código. */
function splitSections(text: string): Section[] {
  const sections: Section[] = [{ heading: '', text: '' }]
  let fence = false
  let titled = false
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const heading = fence ? null : line.match(/^#{1,6}\s+(.*)$/)
    // El primer encabezado es el título: se queda en la cabecera con la introducción.
    if (heading && titled) {
      sections.push({ heading: heading[1] ?? '', text: `${line}\n` })
      continue
    }
    if (heading) titled = true
    sections[sections.length - 1]!.text += `${line}\n`
  }
  return sections
}
