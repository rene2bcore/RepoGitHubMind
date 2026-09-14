import { describe, expect, it } from 'vitest'
import { truncateReadme } from '../src/readme'

/**
 * specs/ai · «Contexto económico» · «README enorme»: se envía truncado
 * conservando la cabecera y las secciones de instalación y uso.
 */
const relleno = (n: number) => 'Texto que no aporta al análisis. '.repeat(n)

describe('truncateReadme', () => {
  it('un README que cabe se envía entero, sin comentarios HTML ni líneas de insignias', () => {
    const readme =
      '# kilo\n\n[![CI](https://x/badge.svg)](https://x) ![stars](https://y.svg)\n<!-- oculto -->\nUn editor pequeño.\n'
    expect(truncateReadme(readme, 1000)).toBe('# kilo\n\nUn editor pequeño.')
  })

  it('uno enorme conserva cabecera, instalación y uso, en su orden, dentro del límite', () => {
    const readme = [
      '# LangGraph\n\nBuild resilient language agents as graphs.\n',
      `## Motivation\n\n${relleno(200)}\n`,
      '## Installation\n\n```bash\npip install -U langgraph\n```\n',
      `## API reference\n\n${relleno(300)}\n`,
      '## Usage\n\n```python\nfrom langgraph.graph import StateGraph\n```\n',
    ].join('\n')
    const out = truncateReadme(readme, 1500)

    expect(readme.length).toBeGreaterThan(10_000)
    expect(out.length).toBeLessThanOrEqual(1500)
    expect(out).toContain('Build resilient language agents as graphs.')
    expect(out).toContain('pip install -U langgraph')
    expect(out).toContain('from langgraph.graph import StateGraph')
    expect(out.indexOf('## Installation')).toBeLessThan(out.indexOf('## Usage'))
  })

  it('un # dentro de un bloque de código no abre sección, y una cabecera gigante no se come la instalación', () => {
    const readme = [
      `# proyecto\n\n${relleno(300)}\n`,
      '## Instalación\n\n```sh\n# instala las dependencias\nnpm install proyecto\n```\n',
      `## Otros\n\n${relleno(300)}\n`,
    ].join('\n')
    const out = truncateReadme(readme, 2000)
    expect(out.length).toBeLessThanOrEqual(2000)
    expect(out).toContain('# instala las dependencias\nnpm install proyecto')
    expect(out).toContain('[…]')
  })
})
