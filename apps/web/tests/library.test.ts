import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@rgm/db'
import { FakeGitHubProvider, setGitHubProvider } from '@rgm/github'
import { GET as list, POST as save } from '@/app/api/v1/repositories/route'
import { GET as detail } from '@/app/api/v1/repositories/[id]/route'
import { PATCH as patch } from '@/app/api/v1/repositories/[id]/personal/route'
import { configureRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { cuentaConSesion, jsonRequest, limpiarBase } from './helpers'

/**
 * specs/library · «Lo mío no lo ve nadie», «Estado personal con nueve
 * valores fijos», «Rating y notas», «Lista con orden y filtros». La frontera
 * privado/público con **dos cuentas** sobre el mismo repositorio (ADR-0008),
 * y validar antes de resolver (ADR-0005).
 */
type Item = {
  id: string
  repository: { fullName: string; readme?: string | null }
  personal: {
    status: string
    favorite: boolean
    rating: number | null
    notes: string | null
    reviewedAt: string | null
  }
}

describe('library', () => {
  beforeAll(async () => {
    await limpiarBase()
    configureRateLimit({ max: 1000, windowMs: 60_000 })
    setGitHubProvider(new FakeGitHubProvider())
  })
  beforeEach(() => resetRateLimit())
  afterAll(async () => {
    setGitHubProvider(null)
    await closeDb()
  })

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
  const guardar = async (cookie: string, url: string): Promise<Item> => {
    const res = await save(
      jsonRequest('/api/v1/repositories', { method: 'POST', body: { url }, cookie }),
      {},
    )
    return ((await res.json()) as { data: Item }).data
  }
  const cambiar = (cookie: string, id: string, body: unknown) =>
    patch(
      jsonRequest(`/api/v1/repositories/${id}/personal`, { method: 'PATCH', body, cookie }),
      ctx(id),
    )
  const ver = (cookie: string, id: string) =>
    detail(jsonRequest(`/api/v1/repositories/${id}`, { cookie }), ctx(id))
  const listar = async (cookie: string, qs = '') =>
    (await (await list(jsonRequest(`/api/v1/repositories${qs}`, { cookie }), {})).json()) as {
      data: Item[]
      meta: { total: number }
    }

  describe('Lo mío no lo ve nadie', () => {
    it('la biblioteca de Grace no trae el estado ni la nota de Ada', async () => {
      const ada = await cuentaConSesion('ada')
      const grace = await cuentaConSesion('grace')
      const deAda = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      await cambiar(ada.cookie, deAda.id, { status: 'USING', notes: 'Lo uso en producción' })
      const deGrace = await guardar(grace.cookie, 'https://github.com/pgvector/pgvector')

      const lista = await listar(grace.cookie)
      expect(lista.meta.total).toBe(1)
      expect(lista.data[0]?.personal).toMatchObject({ status: 'NEW', notes: null })
      expect(JSON.stringify(lista)).not.toContain('Lo uso en producción')

      const detalle = (await (await ver(grace.cookie, deGrace.id)).json()) as { data: Item }
      expect(detalle.data.personal).toMatchObject({ status: 'NEW', notes: null })
      expect(JSON.stringify(detalle)).not.toContain('Lo uso en producción')
      expect(JSON.stringify(detalle)).not.toContain(ada.id)
    })

    it('el id de la relación de otra cuenta es 404 al leer y al modificar, igual que uno inexistente', async () => {
      const ada = await cuentaConSesion('ada')
      const grace = await cuentaConSesion('grace')
      const deAda = await guardar(ada.cookie, 'https://github.com/antirez/kilo')

      const lectura = await ver(grace.cookie, deAda.id)
      expect(lectura.status).toBe(404)
      const cambio = await cambiar(grace.cookie, deAda.id, { status: 'REJECTED' })
      expect(cambio.status).toBe(404)
      const inexistente = await ver(grace.cookie, '00000000-0000-4000-8000-000000000000')
      expect(inexistente.status).toBe(404)
      expect(await lectura.json()).toEqual(await inexistente.json())
      const malformado = await ver(grace.cookie, 'no-es-un-uuid')
      expect(malformado.status).toBe(404)

      // Y nada cambió para Ada.
      const propio = (await (await ver(ada.cookie, deAda.id)).json()) as { data: Item }
      expect(propio.data.personal.status).toBe('NEW')
    })

    it('un userId en el cuerpo se ignora: la respuesta es la de la sesión', async () => {
      const ada = await cuentaConSesion('ada')
      const grace = await cuentaConSesion('grace')
      const deGrace = await guardar(grace.cookie, 'https://github.com/langchain-ai/langgraph')
      const res = await cambiar(grace.cookie, deGrace.id, { status: 'TESTING', userId: ada.id })
      expect(res.status).toBe(200)
      const mia = await listar(grace.cookie)
      expect(mia.data[0]?.personal.status).toBe('TESTING')
      expect((await listar(ada.cookie)).meta.total).toBe(0)
    })
  })

  describe('Estado personal con nueve valores fijos', () => {
    it('cambiar a REVIEWED fija reviewedAt y la respuesta es la relación releída', async () => {
      const ada = await cuentaConSesion('ada')
      const item = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      const res = await cambiar(ada.cookie, item.id, { status: 'REVIEWED' })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { data: Item }
      expect(body.data.personal.status).toBe('REVIEWED')
      expect(body.data.personal.reviewedAt).toEqual(expect.any(String))
      expect(body.data.repository.fullName).toBe('pgvector/pgvector')
    })

    it('un estado inventado es 422 sobre status y el estado no cambia', async () => {
      const ada = await cuentaConSesion('ada')
      const item = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      const res = await cambiar(ada.cookie, item.id, { status: 'DONE' })
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({ errors: [expect.objectContaining({ field: 'status' })] })
      const releido = (await (await ver(ada.cookie, item.id)).json()) as { data: Item }
      expect(releido.data.personal.status).toBe('NEW')
    })

    it('favorito y estado son independientes', async () => {
      const ada = await cuentaConSesion('ada')
      const item = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      await cambiar(ada.cookie, item.id, { status: 'USING' })
      const res = (await (await cambiar(ada.cookie, item.id, { favorite: true })).json()) as {
        data: Item
      }
      expect(res.data.personal).toMatchObject({ status: 'USING', favorite: true })
    })
  })

  describe('Rating y notas', () => {
    it('un rating fuera de rango sobre un id que no existe es 422, no 404', async () => {
      const ada = await cuentaConSesion('ada')
      const res = await cambiar(ada.cookie, '00000000-0000-4000-8000-000000000000', { rating: 6 })
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({ errors: [expect.objectContaining({ field: 'rating' })] })
    })

    it('las notas se quitan con null y un cuerpo vacío es 422', async () => {
      const ada = await cuentaConSesion('ada')
      const item = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      await cambiar(ada.cookie, item.id, { notes: 'probar el índice HNSW', rating: 4 })
      const sinNota = (await (await cambiar(ada.cookie, item.id, { notes: null })).json()) as {
        data: Item
      }
      expect(sinNota.data.personal).toMatchObject({ notes: null, rating: 4 })
      const vacio = await cambiar(ada.cookie, item.id, {})
      expect(vacio.status).toBe(422)
    })
  })

  describe('Lista con orden y filtros', () => {
    it('filtra por estado y por favorito, con meta.total correcto', async () => {
      const ada = await cuentaConSesion('ada')
      const a = await guardar(ada.cookie, 'https://github.com/pgvector/pgvector')
      const b = await guardar(ada.cookie, 'https://github.com/antirez/kilo')
      await guardar(ada.cookie, 'https://github.com/langchain-ai/langgraph')
      await cambiar(ada.cookie, a.id, { status: 'USING', favorite: true })
      await cambiar(ada.cookie, b.id, { status: 'USING' })

      const usando = await listar(ada.cookie, '?status=USING')
      expect(usando.meta.total).toBe(2)
      expect(usando.data.every((x) => x.personal.status === 'USING')).toBe(true)
      const favoritos = await listar(ada.cookie, '?favorite=true')
      expect(favoritos.meta.total).toBe(1)
      expect(favoritos.data[0]?.repository.fullName).toBe('pgvector/pgvector')
      const nada = await listar(ada.cookie, '?status=REJECTED')
      expect(nada).toEqual({ data: [], meta: { total: 0, page: 1, pageSize: 24 } })
    })
  })

  describe('Detalle de un repositorio', () => {
    it('el detalle trae el README crudo y los lenguajes; la lista no', async () => {
      const ada = await cuentaConSesion('ada')
      const item = await guardar(ada.cookie, 'https://github.com/antirez/kilo')
      const res = (await (await ver(ada.cookie, item.id)).json()) as {
        data: { repository: { readme: string; languages: Record<string, number> } }
      }
      expect(res.data.repository.readme).toContain('# Kilo')
      expect(res.data.repository.languages).toEqual({ C: 38000 })
      const lista = await listar(ada.cookie)
      expect(lista.data[0]?.repository).not.toHaveProperty('readme')
    })
  })
})
