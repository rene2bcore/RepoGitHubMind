import { describe, expect, it } from 'vitest'
import { RRF_K, fuseRankings } from '../src/rrf'

/**
 * specs/search · «Búsqueda híbrida»: la lista léxica y la semántica se
 * fusionan con Reciprocal Rank Fusion, con k = 60.
 */
describe('Reciprocal Rank Fusion', () => {
  it('suma 1/(k + puesto) por lista: aparecer en las dos pesa más que ser primero en una sola', () => {
    expect(RRF_K).toBe(60)
    const lexica = ['kilo', 'pgvector', 'langgraph']
    const semantica = ['mem0', 'pgvector']
    const fused = fuseRankings([lexica, semantica])

    expect(fused.map((f) => f.id)).toEqual(['pgvector', 'kilo', 'mem0', 'langgraph'])
    expect(fused[0]).toEqual({ id: 'pgvector', score: 1 / 62 + 1 / 62, ranks: [2, 2] })
    expect(fused[1]).toEqual({ id: 'kilo', score: 1 / 61, ranks: [1, null] })
    expect(fused[3]).toEqual({ id: 'langgraph', score: 1 / 63, ranks: [3, null] })
    // Con k = 0 manda el primer puesto: por eso k existe.
    expect(fuseRankings([lexica, semantica], 0)[0]!.id).toBe('kilo')
  })

  it('los empates se deciden por mejor puesto, después por la primera lista y después por id; un id repetido cuenta una vez', () => {
    // «b» y «a» empatan (1/61 cada uno): gana la léxica, que va primero.
    expect(fuseRankings([['b'], ['a']]).map((f) => f.id)).toEqual(['b', 'a'])
    // Mismo puesto en la misma lista no puede pasar; en listas vacías, nada.
    expect(fuseRankings([[], []])).toEqual([])
    // Empate total entre dos ids en la misma posición de listas distintas y
    // también en la otra: decide el id, siempre igual.
    expect(
      fuseRankings([
        ['y', 'x'],
        ['x', 'y'],
      ]).map((f) => f.id),
    ).toEqual(['x', 'y'])
    // Un id repetido en una lista no suma dos veces ni corre los puestos.
    expect(fuseRankings([['a', 'a', 'b']])).toEqual([
      { id: 'a', score: 1 / 61, ranks: [1] },
      { id: 'b', score: 1 / 62, ranks: [2] },
    ])
  })
})
