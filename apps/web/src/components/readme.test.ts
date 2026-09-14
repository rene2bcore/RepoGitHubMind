import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Readme } from './readme'

/**
 * specs/library · «README hostil» (prompt maestro §43): un `<script>` o un
 * `<iframe>` en el README de GitHub no se ejecuta ni se incrusta, y el resto
 * del Markdown se ve.
 */
const render = (markdown: string) => renderToStaticMarkup(createElement(Readme, { markdown }))

describe('Readme', () => {
  it('no incrusta script, iframe ni HTML crudo, y renderiza el resto', () => {
    const html = render(
      '# Título\n\n<script>window.hostil = true</script>\n\n<iframe src="https://example.com"></iframe>\n\n<img src=x onerror="alert(1)">\n\nTexto **fuerte** y [un enlace](https://example.com).\n\n```sh\nmake\n```\n',
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('onerror')
    expect(html).toContain('<h1>Título</h1>')
    expect(html).toContain('<strong>fuerte</strong>')
    expect(html).toMatch(/<a [^>]*href="https:\/\/example.com"[^>]*rel="noopener noreferrer"/)
    expect(html).toContain('<code')
  })

  it('las tablas de GitHub Flavored Markdown se renderizan', () => {
    expect(render('| a | b |\n| - | - |\n| 1 | 2 |\n')).toContain('<table>')
  })
})
