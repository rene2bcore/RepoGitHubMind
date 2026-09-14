import { Card } from '@/components/ui/card'

/**
 * H1: la biblioteca existe y es privada. Vacía, explica qué es y cuál es la
 * primera acción (specs/library · «Biblioteca vacía con sesión nueva»). El
 * campo para pegar una URL llega con H2.
 */
export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Tu biblioteca</h1>
      <Card>
        <h2 className="mb-2 text-lg font-medium">Todavía no has guardado ningún repositorio</h2>
        <p className="text-sm text-muted">
          Esta es tu biblioteca personal de repositorios de GitHub. Pega la URL de uno y lo verás
          aquí con sus estrellas, su licencia y su última actividad. Nadie más ve lo que guardas ni
          lo que anotas.
        </p>
      </Card>
    </main>
  )
}
