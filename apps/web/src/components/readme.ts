import { createElement, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * El README de GitHub como Markdown saneado (specs/library · «README
 * hostil», prompt maestro §43). `react-markdown` no interpreta HTML crudo, y
 * `skipHtml` lo descarta del todo: un `<script>` o un `<iframe>` no se
 * ejecuta ni se incrusta, y el resto del Markdown se ve. Los enlaces salen
 * con `rel="noopener noreferrer"` y en pestaña nueva.
 *
 * Sin JSX a propósito: así la prueba unitaria lo renderiza con
 * `react-dom/server` sin depender del `jsx: preserve` que Next exige en el
 * tsconfig de la web.
 */
export function Readme({ markdown }: { markdown: string }) {
  return createElement(
    'div',
    { className: 'readme text-sm leading-relaxed', 'data-testid': 'readme' },
    createElement(
      Markdown,
      {
        remarkPlugins: [remarkGfm],
        skipHtml: true,
        components: {
          a: ({ href, children }: { href?: string; children?: ReactNode }) =>
            createElement(
              'a',
              {
                href,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'text-accent underline',
              },
              children,
            ),
        },
      },
      markdown,
    ),
  )
}
