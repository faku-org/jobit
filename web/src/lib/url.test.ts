import { describe, expect, test } from 'bun:test'
import { STATE_SOURCE, EMPTY_FILTERS } from './types.ts'
import { applyViewState, readViewState } from './url.ts'

describe('readViewState', () => {
  test('opens the board with nothing in the address bar', () => {
    expect(readViewState('')).toEqual({
      view: 'all',
      tab: 'saved',
      filters: EMPTY_FILTERS,
    })
  })

  test('lands on the section the link names', () => {
    expect(readViewState('?view=market').view).toBe('market')
    expect(readViewState('?view=test').view).toBe('test')
    expect(readViewState('?view=news').view).toBe('news')
    expect(readViewState('?view=profile').view).toBe('profile')
    expect(readViewState('?view=help').view).toBe('help')
  })

  test('falls back to the board on a section that does not exist', () => {
    expect(readViewState('?view=inventada').view).toBe('all')
  })

  test('un enlace a un servicio abre la sección de servicios', () => {
    expect(readViewState('?service=electricista').view).toBe('services')
  })

  test('la pestaña que el enlace nombra gana sobre el servicio que trae', () => {
    expect(readViewState('?service=electricista&view=market').view).toBe(
      'market',
    )
  })

  test('reads the filters under the names the API takes', () => {
    expect(
      readViewState('?category=salud&department=Canelones&remote=hybrid')
        .filters,
    ).toEqual({
      ...EMPTY_FILTERS,
      category: 'salud',
      department: 'Canelones',
      mode: 'hybrid',
    })
  })

  test('keeps the search text', () => {
    expect(readViewState('?q=aux+de+cocina').filters.q).toBe('aux de cocina')
  })

  test('drops a value outside its dimension instead of asking the API for it', () => {
    const filters = readViewState(
      '?level=experto&job_type=weekend&remote=teleport',
    ).filters
    expect(filters.level).toBe('')
    expect(filters.jobType).toBe('')
    expect(filters.mode).toBe('')
  })

  test('only true turns the no-experience filter on', () => {
    expect(readViewState('?no_experience=true').filters.noExperience).toBe(true)
    expect(readViewState('?no_experience=1').filters.noExperience).toBe(false)
  })

  test('takes a window of days and ignores the ones that are not one', () => {
    expect(readViewState('?days=7').filters.days).toBe(7)
    expect(readViewState('?days=0').filters.days).toBeNull()
    expect(readViewState('?days=-3').filters.days).toBeNull()
    expect(readViewState('?days=ayer').filters.days).toBeNull()
    expect(readViewState('?days=1.5').filters.days).toBeNull()
  })

  test('ignores what belongs to the shared offer and to the embed', () => {
    const state = readViewState('?job=abc123&embed=abc123&view=saved')
    expect(state.view).toBe('saved')
    expect(state.filters).toEqual(EMPTY_FILTERS)
  })

  test('caps a search long enough to be somebody playing', () => {
    expect(readViewState(`?q=${'a'.repeat(500)}`).filters.q).toHaveLength(200)
  })
})

describe('enlaces de la estructura anterior', () => {
  test('?view=tracking abre Seguimiento dentro de Guardadas', () => {
    const state = readViewState('?view=tracking')
    expect(state.view).toBe('saved')
    expect(state.tab).toBe('tracking')
  })

  test('?view=state abre Ofertas con el filtro Estado', () => {
    const state = readViewState('?view=state')
    expect(state.view).toBe('all')
    expect(state.filters.stateOnly).toBe(true)
  })

  test('conserva los filtros que el enlace viejo traía', () => {
    const state = readViewState('?view=state&department=Canelones')
    expect(state.filters.stateOnly).toBe(true)
    expect(state.filters.department).toBe('Canelones')
  })

  test('un nombre heredado de Object no se toma por una vista vieja', () => {
    expect(readViewState('?view=constructor').view).toBe('all')
    expect(readViewState('?view=toString').view).toBe('all')
  })

  test('la barra se reescribe con la forma nueva, sin tocar el resto', () => {
    const tracking = new URL('https://jobs.wefaber.net/?view=tracking&job=abc')
    applyViewState(tracking, readViewState(tracking.search))
    expect(tracking.search).toBe('?view=saved&job=abc&tab=tracking')

    const state = new URL('https://jobs.wefaber.net/?view=state&days=7')
    applyViewState(state, readViewState(state.search))
    expect(state.searchParams.get('view')).toBeNull()
    expect(state.searchParams.get('source')).toBe(STATE_SOURCE)
    expect(state.searchParams.get('days')).toBe('7')
  })
})

describe('Guardadas y el filtro Estado', () => {
  test('tab=tracking solo cuenta dentro de Guardadas', () => {
    expect(readViewState('?view=saved&tab=tracking').tab).toBe('tracking')
    expect(readViewState('?view=saved&tab=otra').tab).toBe('saved')
    expect(readViewState('?view=saved').tab).toBe('saved')
  })

  test('source=uruguayconcursa prende el filtro, cualquier otra fuente no', () => {
    expect(readViewState('?source=uruguayconcursa').filters.stateOnly).toBe(
      true,
    )
    expect(readViewState('?source=gallito').filters.stateOnly).toBe(false)
  })

  test('el filtro Estado no cruza a otra vista', () => {
    expect(
      readViewState('?view=saved&source=uruguayconcursa').filters.stateOnly,
    ).toBe(false)
  })

  test('escribe tab y source solo donde corresponden', () => {
    const write = (state: Parameters<typeof applyViewState>[1]): string => {
      const url = new URL('https://jobs.wefaber.net/')
      applyViewState(url, state)
      return url.search
    }
    const base = { view: 'all' as const, tab: 'saved' as const }

    expect(write({ ...base, filters: EMPTY_FILTERS })).toBe('')
    expect(
      write({ ...base, filters: { ...EMPTY_FILTERS, stateOnly: true } }),
    ).toBe('?source=uruguayconcursa')
    expect(
      write({ view: 'saved', tab: 'tracking', filters: EMPTY_FILTERS }),
    ).toBe('?view=saved&tab=tracking')
    expect(write({ view: 'saved', tab: 'saved', filters: EMPTY_FILTERS })).toBe(
      '?view=saved',
    )
    expect(
      write({
        view: 'market',
        tab: 'tracking',
        filters: { ...EMPTY_FILTERS, stateOnly: true },
      }),
    ).toBe('?view=market')
  })
})
