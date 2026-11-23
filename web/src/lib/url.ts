import {
  EMPTY_FILTERS,
  type Filters,
  type JobType,
  type Level,
  type SavedTab,
  STATE_SOURCE,
  type View,
  type WorkMode,
} from './types.ts'

/**
 * The part of the screen that belongs in the address bar, so the link the
 * person copies lands on what they were looking at instead of on the board
 * from scratch.
 *
 * What depends on the reader's own browser stays out: "solo similares" reads
 * preferences that live in the other person's storage, and the rubro chips
 * over the saved list are about a list only its owner has. Both would mean
 * something different on the other side, or nothing at all.
 */
export interface ViewState {
  view: View
  filters: Filters
  /** Qué lista de Guardadas se mira; en las demás vistas no cuenta. */
  tab: SavedTab
}

const VIEWS: View[] = [
  'all',
  'saved',
  'services',
  'market',
  'news',
  'test',
  'profile',
  'settings',
  'help',
]

/**
 * Los enlaces que ya andan por ahí con la estructura anterior: Seguimiento era
 * una pestaña y Estado otra. Se leen como lo que son hoy y la barra de
 * direcciones se reescribe sola con la forma nueva.
 */
const LEGACY: Record<string, { view: View; tab?: SavedTab; stateOnly?: true }> =
  {
    tracking: { view: 'saved', tab: 'tracking' },
    state: { view: 'all', stateOnly: true },
  }

/**
 * Apariencia vivía en el perfil (`?view=profile#apariencia`) y pasó a
 * Preferencias, que es su propia página. El ancla viejo se lee como la view
 * nueva; la barra se reescribe sola porque el ancla de una view que no es el
 * perfil se descarta.
 */
const MOVED_ANCHORS: Record<string, View> = { apariencia: 'settings' }
const LEVELS: Level[] = ['entry', 'mid', 'senior']
const MODES: WorkMode[] = ['onsite', 'remote', 'hybrid']
const JOB_TYPES: JobType[] = ['full_time', 'part_time', 'internship']

/** The names the API already takes, so the project keeps one vocabulary. */
const PARAM = {
  view: 'view',
  tab: 'tab',
  /** Como en la API: `source=uruguayconcursa` es el filtro Estado. */
  source: 'source',
  q: 'q',
  category: 'category',
  department: 'department',
  company: 'company',
  level: 'level',
  mode: 'remote',
  jobType: 'job_type',
  noExperience: 'no_experience',
  days: 'days',
  /** La página de armar mensaje de la ficha abierta (`?job=…&apply=1`). */
  apply: 'apply',
} as const

const MAX_QUERY = 200

/** Anything outside the union reads as "not set": a hand-edited or truncated
 * link should still open the board rather than ask the API for nonsense. */
const oneOf = <T extends string>(raw: string | null, allowed: T[]): T | '' =>
  allowed.find((value) => value === raw) ?? ''

const positiveInteger = (raw: string | null): number | null => {
  if (raw === null) return null
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

export function readViewState(
  search: string = window.location.search,
  hash: string = typeof window === 'undefined' ? '' : window.location.hash,
): ViewState {
  const params = new URLSearchParams(search)

  /** Un enlace a un servicio no trae pestaña, pero sí dice cuál: abrir la
   * ficha sobre el tablero de ofertas dejaría atrás una lista que no tiene
   * nada que ver con lo que la persona vino a mirar. */
  const linkedService = params.get('service') ? 'services' : 'all'

  const named = params.get(PARAM.view) ?? ''
  const legacy = Object.hasOwn(LEGACY, named) ? LEGACY[named] : undefined
  const requested: View =
    legacy?.view ?? VIEWS.find((value) => value === named) ?? linkedService
  const anchor = hash.slice(1)
  const moved = Object.hasOwn(MOVED_ANCHORS, anchor)
    ? MOVED_ANCHORS[anchor]
    : undefined
  const view: View = requested === 'profile' && moved ? moved : requested

  return {
    view,
    tab:
      legacy?.tab ??
      (params.get(PARAM.tab) === 'tracking' ? 'tracking' : 'saved'),
    filters: {
      ...EMPTY_FILTERS,
      /** Es un filtro de Ofertas: en otra vista no quiere decir nada. */
      stateOnly:
        view === 'all' &&
        (legacy?.stateOnly === true ||
          params.get(PARAM.source) === STATE_SOURCE),
      q: params.get(PARAM.q)?.slice(0, MAX_QUERY) ?? '',
      category: params.get(PARAM.category) ?? '',
      department: params.get(PARAM.department) ?? '',
      company: params.get(PARAM.company) ?? '',
      level: oneOf(params.get(PARAM.level), LEVELS),
      mode: oneOf(params.get(PARAM.mode), MODES),
      jobType: oneOf(params.get(PARAM.jobType), JOB_TYPES),
      noExperience: params.get(PARAM.noExperience) === 'true',
      days: positiveInteger(params.get(PARAM.days)),
    },
  }
}

/**
 * Writes the state over whatever else the address bar carries: it only ever
 * touches its own parameters, so the `?job=` a shared link came with survives
 * a change of tab.
 *
 * A tab is a place the back button should return to, so it is pushed. A filter
 * is not: pushing those would turn every letter typed into the search box into
 * a step of the history to walk back out of.
 */
export function applyViewState(url: URL, state: ViewState): void {
  const { view, filters, tab } = state

  const set = (name: string, value: string): void => {
    if (value) url.searchParams.set(name, value)
    else url.searchParams.delete(name)
  }

  set(PARAM.view, view === 'all' ? '' : view)
  set(PARAM.tab, view === 'saved' && tab === 'tracking' ? tab : '')
  set(PARAM.source, view === 'all' && filters.stateOnly ? STATE_SOURCE : '')
  set(PARAM.q, filters.q.trim())
  set(PARAM.category, filters.category)
  set(PARAM.department, filters.department)
  set(PARAM.company, filters.company)
  set(PARAM.level, filters.level)
  set(PARAM.mode, filters.mode)
  set(PARAM.jobType, filters.jobType)
  set(PARAM.noExperience, filters.noExperience ? 'true' : '')
  set(PARAM.days, filters.days === null ? '' : String(filters.days))

  /* Un ancla (`#cv`) solo nombra una sección de la página de perfil. */
  if (view !== 'profile') url.hash = ''
}

export function writeViewState(state: ViewState, push: boolean): void {
  const url = new URL(window.location.href)
  applyViewState(url, state)

  const next = url.toString()
  if (next === window.location.href) return
  if (push) window.history.pushState(null, '', next)
  else window.history.replaceState(null, '', next)
}

/**
 * La ficha de una oferta tiene dos páginas: la oferta y el armado del mensaje.
 * `apply=1` es la segunda, así el enlace de "armar mensaje" se puede compartir
 * o recargar y cae en la misma página. Va junto a `job` y, como él, no suma un
 * paso al historial: Atrás sale de la ficha, no de una página de la ficha.
 */
export const readApplyOpen = (
  search: string = window.location.search,
): boolean => new URLSearchParams(search).get(PARAM.apply) === '1'

/** Escribe o saca `apply` y deja todo lo demás de la dirección como estaba. */
export function applyApplyOpen(url: URL, open: boolean): void {
  if (open) url.searchParams.set(PARAM.apply, '1')
  else url.searchParams.delete(PARAM.apply)
}

export function writeApplyOpen(open: boolean): void {
  const url = new URL(window.location.href)
  applyApplyOpen(url, open)

  const next = url.toString()
  if (next !== window.location.href) window.history.replaceState(null, '', next)
}
