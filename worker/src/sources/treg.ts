import { DEPARTMENTS, fold, singleDepartment } from '../departments.ts'
import { fetchJson } from '../http.ts'
import type { JobDetail, JobStub, Remote, Source } from '../types.ts'

/**
 * Gateway treg.to (https://treg.to/jobs-api): un proxy de proveedores de empleo.
 * APAGADA por defecto: la fuente solo se registra si hay config en el entorno.
 *
 *   JOBIT_TREG_BOARDS   'greenhouse:slug,lever:site,ashby:board'  (gratis, sin token)
 *   JOBIT_TREG_TOKEN    token del gateway (solo la búsqueda paga)
 *   JOBIT_TREG_SEARCH   '1' enciende la búsqueda paga por país (requiere token)
 *   JOBIT_TREG_MAX_COST tope por llamada, va en X-Treg-Route-Max-Cost (default 0.05)
 */
const BASE = 'https://treg.to/call'
const DELAY_MS = 800
const DEFAULT_MAX_COST = '0.05'
const SEARCH_LIMIT = 50
const SEARCH_MAX_PAGES = 3

export type Provider = 'greenhouse' | 'lever' | 'ashby'

export interface Board {
  provider: Provider
  id: string
}

export interface TregConfig {
  boards: Board[]
  token: string | null
  search: boolean
  maxCost: string
}

const PROVIDERS: readonly string[] = ['greenhouse', 'lever', 'ashby']

type Env = Record<string, string | undefined>

/** 'greenhouse:slug,lever:site' a lista; lo mal formado se descarta. */
export function parseBoards(value: string | undefined): Board[] {
  const boards: Board[] = []
  for (const part of (value ?? '').split(',')) {
    const [provider, id] = part
      .trim()
      .split(':')
      .map((p) => p.trim())
    if (!provider || !id || !PROVIDERS.includes(provider)) continue
    if (!/^[\w.-]+$/.test(id)) continue
    boards.push({ provider: provider as Provider, id })
  }
  return boards
}

export function readConfig(env: Env = process.env): TregConfig {
  const token = (env.JOBIT_TREG_TOKEN ?? '').trim() || null
  const cost = Number((env.JOBIT_TREG_MAX_COST ?? '').trim())
  return {
    boards: parseBoards(env.JOBIT_TREG_BOARDS),
    token,
    // La búsqueda paga sin token no puede andar: se apaga sola.
    search: env.JOBIT_TREG_SEARCH === '1' && token !== null,
    maxCost:
      Number.isFinite(cost) && cost > 0 ? String(cost) : DEFAULT_MAX_COST,
  }
}

export const tregEnabled = (env: Env = process.env): boolean => {
  const config = readConfig(env)
  return config.boards.length > 0 || config.search
}

// --- guards sobre filas sin esquema ------------------------------------------

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Primer valor string no vacío entre las claves dadas. */
function text(row: Row, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value)
  }
  return null
}

function httpUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

/** La ubicación puede venir como string, {name}, o lista de ambas. */
function locationText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(locationText).join(' | ')
  if (isRow(value)) {
    return [
      text(value, 'name', 'location', 'city', 'region', 'country'),
      text(value, 'addressLocality', 'addressRegion', 'addressCountry'),
      isRow(value.postalAddress) ? locationText(value.postalAddress) : null,
    ]
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

/** Departamentos que también son lugares de otros países: piden "Uruguay"/"UY". */
const AMBIGUOUS = new Set(
  ['Florida', 'San José', 'Colonia', 'Flores', 'Salto', 'Rivera', 'Rocha'].map(
    fold,
  ),
)

/** ¿El texto libre de ubicación cae en Uruguay? */
export function isUruguay(location: string): boolean {
  const haystack = fold(location)
  if (!haystack) return false
  if (/\buruguay\b|\bmontevideo\b|\buy\b/.test(haystack)) return true
  return DEPARTMENTS.some(
    (name) =>
      !AMBIGUOUS.has(fold(name)) &&
      new RegExp(`\\b${fold(name)}\\b`).test(haystack),
  )
}

function isRemoteText(value: string): Remote | null {
  const folded = fold(value)
  if (/\bhybrid\b|\bhibrido\b/.test(folded)) return 'hybrid'
  if (/\bremote\b|\bremoto\b|\bteletrabajo\b/.test(folded)) return 'remote'
  return null
}

function stripHtml(value: string): string {
  // Greenhouse entrega el HTML escapado (&lt;p&gt;): se desescapa antes de limpiar.
  const unescaped = value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
  return unescaped
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isoDate(value: unknown): string | null {
  const date =
    typeof value === 'number'
      ? new Date(value)
      : typeof value === 'string' && value.trim()
        ? new Date(value)
        : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

/** Las listas de los proveedores vienen en `jobs`, `postings`, `output.jobs` o sueltas. */
export function extractRows(payload: unknown): Row[] {
  const candidates: unknown[] = []
  if (Array.isArray(payload)) candidates.push(payload)
  if (isRow(payload)) {
    candidates.push(payload.jobs, payload.postings, payload.data)
    if (isRow(payload.output)) {
      candidates.push(payload.output.jobs, payload.output.postings)
    }
  }
  const list = candidates.find(Array.isArray) as unknown[] | undefined
  return (list ?? []).filter(isRow)
}

// --- mapeo a JobStub ---------------------------------------------------------

/** Fila ya mapeada + el crudo, que es lo que queda en el cache de detalle. */
export interface Mapped {
  stub: JobStub
  raw: Row
}

function stubOf(
  fields: {
    id: string
    title: string | null
    url: string | null
    company: string | null
    location: string
    date: string | null
    remote: Remote | null
  },
  raw: Row,
  today: string,
): Mapped | null {
  const url = httpUrl(fields.url)
  if (!fields.title || !url) return null
  return {
    raw,
    stub: {
      source: 'treg',
      source_id: fields.id,
      title: fields.title,
      company: fields.company,
      department: singleDepartment(fields.location),
      city: null,
      category_raw: 'otros',
      date_posted: fields.date ?? today,
      remote: fields.remote,
      job_type: null,
      no_experience: false,
      apply_url: url,
    },
  }
}

/** Boards gratis: solo se queda lo que la ubicación ubica en Uruguay. */
export function mapBoardRow(
  board: Board,
  row: Row,
  today = new Date().toISOString(),
): Mapped | null {
  const key = `${board.provider}:${board.id}:`
  let fields: Parameters<typeof stubOf>[0]
  let location: string

  if (board.provider === 'greenhouse') {
    const id = text(row, 'id')
    location = locationText(row.location)
    if (!id) return null
    fields = {
      id: key + id,
      title: text(row, 'title'),
      url: text(row, 'absolute_url'),
      company: text(row, 'company_name'),
      location,
      date: isoDate(row.first_published) ?? isoDate(row.updated_at),
      remote: isRemoteText(location),
    }
  } else if (board.provider === 'lever') {
    const id = text(row, 'id')
    const categories = isRow(row.categories) ? row.categories : {}
    location = [
      locationText(categories.location),
      locationText(categories.allLocations),
      text(row, 'country') ?? '',
    ].join(' | ')
    if (!id) return null
    fields = {
      id: key + id,
      title: text(row, 'text', 'title'),
      url: text(row, 'hostedUrl', 'applyUrl'),
      company: null,
      location,
      date: isoDate(row.createdAt),
      remote: isRemoteText(text(row, 'workplaceType') ?? location),
    }
  } else {
    const id = text(row, 'id') ?? text(row, 'jobUrl')
    location = [
      locationText(row.location),
      locationText(row.secondaryLocations),
      locationText(row.address),
    ].join(' | ')
    if (!id) return null
    fields = {
      id: key + id,
      title: text(row, 'title'),
      url: text(row, 'jobUrl', 'applyUrl'),
      company: null,
      location,
      date: isoDate(row.publishedAt),
      remote: row.isRemote === true ? 'remote' : isRemoteText(location),
    }
  }

  if (!isUruguay(location)) return null
  return stubOf(fields, row, today)
}

/** Búsqueda paga: filas nativas del proveedor, sin esquema único. El gateway ya
 * filtró por país, así que no se vuelve a filtrar por texto. */
export function mapSearchRow(
  row: Row,
  today = new Date().toISOString(),
): Mapped | null {
  const url = text(
    row,
    'absolute_url',
    'job_url',
    'jobUrl',
    'apply_url',
    'applyUrl',
    'hostedUrl',
    'url',
    'link',
  )
  const location = locationText(
    row.location ?? row.job_location ?? row.city ?? row.formatted_location,
  )
  const id = text(row, 'id', 'job_id', 'jobId', 'uuid') ?? url
  if (!id) return null
  return stubOf(
    {
      id: `search:${id}`,
      title: text(
        row,
        'title',
        'job_title',
        'jobTitle',
        'name',
        'position',
        'text',
      ),
      url,
      company: text(row, 'company_name', 'company', 'employer', 'organization'),
      location,
      date: isoDate(
        row.posted_at ??
          row.date_posted ??
          row.published_at ??
          row.publishedAt ??
          row.first_published ??
          row.created_at ??
          row.updated_at,
      ),
      remote:
        row.remote === true || row.is_remote === true || row.isRemote === true
          ? 'remote'
          : isRemoteText(location),
    },
    row,
    today,
  )
}

// --- detalle -----------------------------------------------------------------

function salaryOf(row: Row): JobDetail['salary'] {
  const range = isRow(row.salaryRange) ? row.salaryRange : null
  if (!range) return null
  const min = typeof range.min === 'number' ? range.min : null
  const max = typeof range.max === 'number' ? range.max : null
  if (min === null && max === null) return null
  return { min, max, currency: text(range, 'currency') ?? 'USD' }
}

/** El crudo es la fila del proveedor tal cual: parsearla nunca debe tirar. */
export function parseDetail(raw: unknown): JobDetail | null {
  if (!isRow(raw)) return null
  const plain = text(raw, 'descriptionPlain')
  const html = text(
    raw,
    'content',
    'descriptionHtml',
    'description',
    'job_description',
    'body',
  )
  const description = plain ?? (html ? stripHtml(html) : '')
  const commitment = isRow(raw.categories)
    ? text(raw.categories, 'commitment')
    : text(raw, 'employmentType', 'employment_type')
  const kind = fold(commitment ?? '')

  return {
    description,
    requirements: null,
    salary: salaryOf(raw),
    experience_years_min: null,
    education_level: null,
    schedule: null,
    vacancies: null,
    closes_at: null,
    no_experience: false,
    job_type: /intern|pasant/.test(kind)
      ? 'internship'
      : /part.?time|medio/.test(kind)
        ? 'part_time'
        : /full.?time|completo/.test(kind)
          ? 'full_time'
          : null,
  }
}

// --- recolección -------------------------------------------------------------

/** Lo que collect() ve y fetchDetail() devuelve sin pedir nada de nuevo. */
const rawBySourceId = new Map<string, Row>()

function boardUrl(board: Board): string {
  const id = encodeURIComponent(board.id)
  switch (board.provider) {
    case 'greenhouse':
      return `${BASE}/greenhouse.companies.jobs?board_token=${id}&content=true`
    case 'lever':
      return `${BASE}/lever.postings.list?site=${id}&mode=json`
    case 'ashby':
      return `${BASE}/ashby.companies.jobs?board=${id}`
  }
}

async function collectBoards(
  boards: Board[],
  onProgress: (message: string) => void,
  into: Map<string, Mapped>,
): Promise<void> {
  for (const board of boards) {
    const payload = await fetchJson<unknown>(boardUrl(board), DELAY_MS)
    const rows = extractRows(payload)
    let kept = 0
    for (const row of rows) {
      const mapped = mapBoardRow(board, row)
      if (mapped) {
        into.set(mapped.stub.source_id, mapped)
        kept++
      }
    }
    onProgress(
      `  ${board.provider}:${board.id}: ${kept}/${rows.length} en Uruguay`,
    )
  }
}

async function collectSearch(
  config: TregConfig,
  onProgress: (message: string) => void,
  into: Map<string, Mapped>,
): Promise<void> {
  let cursor: string | null = null

  for (let page = 0; page < SEARCH_MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      country: 'UY',
      limit: SEARCH_LIMIT,
      ...(cursor ? { cursor } : {}),
    }
    const payload = await fetchJson<unknown>(
      `${BASE}/treg.companies.jobs.search`,
      DELAY_MS,
      {
        body,
        // Una búsqueda paga que falla no se reintenta: cada intento cuesta.
        retries: 0,
        headers: {
          'X-Treg-Token': config.token ?? '',
          'X-Treg-Route-Max-Cost': config.maxCost,
        },
      },
    )
    const output =
      isRow(payload) && isRow(payload.output) ? payload.output : null
    if (!output) break

    const rows = extractRows(output)
    for (const row of rows) {
      const mapped = mapSearchRow(row)
      if (mapped) into.set(mapped.stub.source_id, mapped)
    }
    onProgress(`  búsqueda UY página ${page + 1}: ${rows.length} filas`)

    const next = text(output, 'next_cursor')
    if (!next || rows.length === 0) break
    cursor = next
  }
}

async function collect(
  onProgress: (message: string) => void,
): Promise<JobStub[]> {
  const config = readConfig()
  const found = new Map<string, Mapped>()

  await collectBoards(config.boards, onProgress, found)
  if (config.search) await collectSearch(config, onProgress, found)

  rawBySourceId.clear()
  for (const [id, mapped] of found) rawBySourceId.set(id, mapped.raw)
  return [...found.values()].map((mapped) => mapped.stub)
}

export const treg: Source = {
  id: 'treg',
  collect,
  // La fila del listado ya trae el detalle: no hay segundo pedido que pagar.
  fetchDetail: async (stub) => rawBySourceId.get(stub.source_id) ?? null,
  parseDetail,
}
