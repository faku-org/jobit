import { describe, expect, test } from 'bun:test'
import {
  extractRows,
  isUruguay,
  mapBoardRow,
  mapSearchRow,
  parseBoards,
  parseDetail,
  readConfig,
  tregEnabled,
} from './treg.ts'

const TODAY = '2026-11-23T00:00:00.000Z'

describe('config', () => {
  test('sin variables está apagada', () => {
    expect(tregEnabled({})).toBe(false)
  })

  test('boards gratis la encienden sin token', () => {
    const env = { JOBIT_TREG_BOARDS: 'greenhouse:acme, lever:foo ,ashby:bar' }
    expect(tregEnabled(env)).toBe(true)
    expect(readConfig(env).boards).toEqual([
      { provider: 'greenhouse', id: 'acme' },
      { provider: 'lever', id: 'foo' },
      { provider: 'ashby', id: 'bar' },
    ])
  })

  test('descarta proveedores y slugs inválidos', () => {
    expect(
      parseBoards('workday:x,greenhouse:,lever:a/b,greenhouse:ok'),
    ).toEqual([{ provider: 'greenhouse', id: 'ok' }])
  })

  test('la búsqueda paga exige token', () => {
    expect(tregEnabled({ JOBIT_TREG_SEARCH: '1' })).toBe(false)
    const env = { JOBIT_TREG_SEARCH: '1', JOBIT_TREG_TOKEN: 't' }
    expect(tregEnabled(env)).toBe(true)
    expect(readConfig(env).maxCost).toBe('0.05')
    expect(readConfig({ ...env, JOBIT_TREG_MAX_COST: '0.2' }).maxCost).toBe(
      '0.2',
    )
    expect(readConfig({ ...env, JOBIT_TREG_MAX_COST: 'abc' }).maxCost).toBe(
      '0.05',
    )
  })
})

describe('isUruguay', () => {
  test('reconoce país, capital y departamentos', () => {
    expect(isUruguay('Montevideo, Uruguay')).toBe(true)
    expect(isUruguay('Remote - UY')).toBe(true)
    expect(isUruguay('Maldonado')).toBe(true)
    expect(isUruguay('Paysandu')).toBe(true)
  })

  test('los departamentos ambiguos piden país', () => {
    expect(isUruguay('Florida, USA')).toBe(false)
    expect(isUruguay('San José, Costa Rica')).toBe(false)
    expect(isUruguay('Salto, Uruguay')).toBe(true)
  })

  test('otros lugares y vacío', () => {
    expect(isUruguay('Buenos Aires, Argentina')).toBe(false)
    expect(isUruguay('')).toBe(false)
  })
})

describe('greenhouse', () => {
  const board = { provider: 'greenhouse', id: 'acme' } as const
  const row = {
    id: 123,
    title: 'Backend Engineer',
    absolute_url: 'https://boards.greenhouse.io/acme/jobs/123',
    location: { name: 'Montevideo, Uruguay' },
    first_published: '2026-11-01T10:00:00-03:00',
    company_name: 'Acme',
    content:
      '&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Bun&lt;/li&gt;&lt;/ul&gt;',
  }

  test('mapea a JobStub', () => {
    const mapped = mapBoardRow(board, row, TODAY)
    expect(mapped?.stub).toMatchObject({
      source: 'treg',
      source_id: 'greenhouse:acme:123',
      title: 'Backend Engineer',
      company: 'Acme',
      department: 'Montevideo',
      date_posted: '2026-11-01T13:00:00.000Z',
      apply_url: 'https://boards.greenhouse.io/acme/jobs/123',
    })
  })

  test('el detalle limpia el HTML escapado', () => {
    const detail = parseDetail(row)
    expect(detail?.description).toBe('Build & ship\n- Bun')
  })

  test('filtra lo que no es de Uruguay', () => {
    const abroad = { ...row, location: { name: 'Austin, TX' } }
    expect(mapBoardRow(board, abroad, TODAY)).toBeNull()
  })

  test('descarta filas sin título o sin URL válida', () => {
    expect(mapBoardRow(board, { ...row, title: '' }, TODAY)).toBeNull()
    expect(
      mapBoardRow(board, { ...row, absolute_url: 'javascript:x' }, TODAY),
    ).toBeNull()
    expect(
      mapBoardRow(board, { ...row, absolute_url: undefined }, TODAY),
    ).toBeNull()
    expect(mapBoardRow(board, { ...row, id: undefined }, TODAY)).toBeNull()
  })
})

describe('lever y ashby', () => {
  test('lever: remoto, fecha en ms y descripción plana', () => {
    const row = {
      id: 'abc-1',
      text: 'Data Analyst',
      hostedUrl: 'https://jobs.lever.co/foo/abc-1',
      createdAt: 1_790_000_000_000,
      categories: { location: 'Uruguay', commitment: 'Full-time' },
      workplaceType: 'remote',
      descriptionPlain: 'Analizá datos.',
    }
    const mapped = mapBoardRow({ provider: 'lever', id: 'foo' }, row, TODAY)
    expect(mapped?.stub.remote).toBe('remote')
    expect(mapped?.stub.date_posted).toBe(
      new Date(1_790_000_000_000).toISOString(),
    )
    expect(parseDetail(row)).toMatchObject({
      description: 'Analizá datos.',
      job_type: 'full_time',
    })
  })

  test('ashby: isRemote y ubicación anidada', () => {
    const row = {
      id: 'x1',
      title: 'Designer',
      jobUrl: 'https://jobs.ashbyhq.com/bar/x1',
      location: 'Montevideo',
      isRemote: true,
      publishedAt: '2026-11-10T00:00:00Z',
    }
    const mapped = mapBoardRow({ provider: 'ashby', id: 'bar' }, row, TODAY)
    expect(mapped?.stub).toMatchObject({
      remote: 'remote',
      department: 'Montevideo',
    })
  })
})

describe('búsqueda paga', () => {
  test('filas con claves distintas', () => {
    const a = mapSearchRow(
      {
        job_id: 'j1',
        job_title: 'Cajero',
        employer: 'Super',
        url: 'https://x.test/j1',
        location: 'Rivera, Uruguay',
      },
      TODAY,
    )
    expect(a?.stub).toMatchObject({
      source_id: 'search:j1',
      title: 'Cajero',
      company: 'Super',
      date_posted: TODAY,
    })

    const b = mapSearchRow({ title: 'Mozo', link: 'https://x.test/j2' }, TODAY)
    expect(b?.stub.source_id).toBe('search:https://x.test/j2')
  })

  test('descarta filas inservibles sin tirar', () => {
    expect(mapSearchRow({}, TODAY)).toBeNull()
    expect(mapSearchRow({ title: 'Sin URL', id: 1 }, TODAY)).toBeNull()
    expect(mapSearchRow({ url: 'https://x.test', id: 1 }, TODAY)).toBeNull()
  })
})

describe('extractRows', () => {
  test('acepta las formas conocidas y rechaza el resto', () => {
    expect(extractRows({ jobs: [{ a: 1 }, 'x', null] })).toEqual([{ a: 1 }])
    expect(extractRows({ output: { jobs: [{ b: 2 }] } })).toEqual([{ b: 2 }])
    expect(extractRows([{ c: 3 }])).toEqual([{ c: 3 }])
    expect(extractRows({ nope: true })).toEqual([])
    expect(extractRows(null)).toEqual([])
  })
})

describe('parseDetail', () => {
  test('tolera basura', () => {
    expect(parseDetail(null)).toBeNull()
    expect(parseDetail('x')).toBeNull()
    expect(parseDetail({})?.description).toBe('')
  })
})
