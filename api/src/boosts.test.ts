import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Service } from './services.ts'

process.env.DB_FILE = ':memory:'
process.env.ADMIN_INSECURE_COOKIES = 'true'

const { closeDb, db } = await import('./db.ts')
const { resetLimits } = await import('./limit.ts')
const { app } = await import('./index.ts')
const boosts = await import('./boosts.ts')
const services = await import('./services.ts')
const users = await import('./users.ts')

const HASH = await Bun.password.hash('abrite sesamo')
const NOW = new Date('2026-11-05T12:00:00Z')

let userId = ''

beforeEach(async () => {
  closeDb()
  resetLimits()
  process.env.ADMIN_PASSWORD_HASH = HASH

  const created = await users.create({
    handle: 'juana',
    display_name: 'Juana Pérez',
    password: 'una clave larga',
  })
  if (!created.ok) throw new Error(created.error)
  userId = created.value.user.id
})

/** Un servicio ya publicado, con la fecha de alta que se le pida. */
function publish(
  title: string,
  publishedAt = '2026-10-01',
  extra: Record<string, unknown> = {},
) {
  const created = services.create(userId, {
    title,
    category: 'oficios',
    ...extra,
  } as Parameters<typeof services.create>[1])
  if (!created.ok) throw new Error(created.error)
  services.setStatus(
    created.value.id,
    'published',
    new Date(`${publishedAt}T12:00:00Z`),
  )
  return created.value.id
}

const page = (over: Partial<Parameters<typeof services.search>[0]> = {}) =>
  services.search({ limit: 50, offset: 0, ...over }, null, NOW)

const titles = (found: ReturnType<typeof page>): string[] =>
  found.services.map((service) => service.title)

describe('grant y vencimiento', () => {
  test('hoy cuenta como el primer día y el último es inclusive', () => {
    const id = publish('Electricista')
    const granted = boosts.grant(id, 'featured', 3, NOW)

    expect(granted).toEqual({
      ok: true,
      value: { service_id: id, kind: 'featured', until: '2026-11-07' },
    })
    expect(
      boosts.isBoosted(
        { boost_until: '2026-11-07', status: 'published' },
        new Date('2026-11-07T23:59:00Z'),
      ),
    ).toBe(true)
    expect(
      boosts.isBoosted(
        { boost_until: '2026-11-07', status: 'published' },
        new Date('2026-11-08T00:00:00Z'),
      ),
    ).toBe(false)
  })

  test('vence solo: sin ningún trabajo que lo apague', () => {
    const id = publish('Electricista')
    boosts.grant(id, 'featured', 2, NOW)

    expect(
      services.search({ limit: 10, offset: 0 }, null, NOW).services[0]
        ?.featured,
    ).toBe(true)
    expect(
      services.search(
        { limit: 10, offset: 0 },
        null,
        new Date('2026-12-01T00:00:00Z'),
      ).services[0]?.featured,
    ).toBe(false)
  })

  test('extender suma al final de lo que quedaba y no desde hoy', () => {
    const id = publish('Electricista')
    boosts.grant(id, 'featured', 5, NOW)
    const extended = boosts.grant(
      id,
      'featured',
      5,
      new Date('2026-11-07T12:00:00Z'),
    )

    expect(extended.ok && extended.value.until).toBe('2026-11-14')
  })

  test('uno vencido arranca de nuevo desde hoy', () => {
    const id = publish('Electricista')
    boosts.grant(id, 'featured', 2, new Date('2026-10-01T12:00:00Z'))

    const again = boosts.grant(id, 'featured', 2, NOW)
    expect(again.ok && again.value.until).toBe('2026-11-06')
  })

  test('rechaza días fuera de rango y un tope acumulado', () => {
    const id = publish('Electricista')

    expect(boosts.grant(id, 'featured', 0, NOW).ok).toBe(false)
    expect(boosts.grant(id, 'featured', 1.5, NOW).ok).toBe(false)
    expect(
      boosts.grant(id, 'featured', boosts.MAX_GRANT_DAYS + 1, NOW).ok,
    ).toBe(false)

    for (let step = 0; step < 4; step++)
      boosts.grant(id, 'featured', boosts.MAX_GRANT_DAYS, NOW)
    const over = boosts.grant(id, 'featured', boosts.MAX_GRANT_DAYS, NOW)
    expect(over.ok).toBe(false)
  })

  test('un servicio que no existe no se destaca', () => {
    const result = boosts.grant('no-existe', 'featured', 3, NOW)
    expect(result).toEqual({ ok: false, error: 'ese servicio no existe' })
  })

  test('revoke lo apaga del todo', () => {
    const id = publish('Electricista')
    boosts.grant(id, 'featured', 3, NOW)

    expect(boosts.revoke(id)).toBe(true)
    const row = services.byId(id)
    expect(row?.featured).toBe(false)
    expect(row?.boost_until).toBe('')
    expect(row?.boost_kind).toBe('')
    expect(boosts.revoke('no-existe')).toBe(false)
  })

  test('un servicio que dejó de estar publicado no figura como destacado', () => {
    const id = publish('Electricista')
    boosts.grant(id, 'featured', 30, NOW)
    services.setStatus(id, 'suspended', NOW)

    expect(services.byId(id)?.featured).toBe(false)
    expect(boosts.active(NOW)).toEqual([])
  })
})

describe('el orden de la lista', () => {
  test('los destacados van primero y siempre marcados', () => {
    publish('A reciente', '2026-10-20')
    const viejo = publish('B viejo', '2026-09-01')
    publish('C medio', '2026-10-01')
    boosts.grant(viejo, 'featured', 7, NOW)

    const found = page()
    expect(titles(found)).toEqual(['B viejo', 'A reciente', 'C medio'])
    expect(found.services.map((service) => service.featured)).toEqual([
      true,
      false,
      false,
    ])
  })

  test('adentro de cada grupo sigue el mismo orden de siempre', () => {
    publish('A', '2026-10-20')
    const b = publish('B', '2026-10-10')
    publish('C', '2026-10-15')
    const d = publish('D', '2026-10-01')
    boosts.grant(d, 'featured', 7, NOW)
    boosts.grant(b, 'featured', 7, NOW)

    /* Entre destacados y entre el resto, lo más reciente primero. */
    expect(titles(page())).toEqual(['B', 'D', 'A', 'C'])
  })

  test('también con otro orden: pagar cambia de grupo y no la posición adentro', () => {
    const peor = publish('Peor', '2026-10-01')
    const mejor = publish('Mejor', '2026-10-02')
    const medio = publish('Medio', '2026-10-03')

    for (const [id, avg] of [
      [peor, 2],
      [mejor, 5],
      [medio, 4],
    ] as const) {
      db().run(
        'UPDATE services SET rating_avg = ?, rating_count = 3 WHERE id = ?',
        [avg, id],
      )
    }
    boosts.grant(peor, 'featured', 7, NOW)

    /* Un destacado malo aparece antes, pero no le gana a otro destacado mejor. */
    boosts.grant(mejor, 'featured', 7, NOW)
    expect(titles(page({ sort: 'rating' }))).toEqual(['Mejor', 'Peor', 'Medio'])
  })

  test('un destacado no se cuela si no cumple el filtro', () => {
    const fuera = publish('Plomero', '2026-10-01', { category: 'tecnologia' })
    publish('Electricista')
    boosts.grant(fuera, 'featured', 7, NOW)

    expect(titles(page({ category: 'oficios' }))).toEqual(['Electricista'])
  })

  test('el total no cambia por destacar', () => {
    const id = publish('A')
    publish('B')
    const before = page().total
    boosts.grant(id, 'featured', 7, NOW)

    expect(page().total).toBe(before)
  })

  test('uno en revisión no aparece aunque tenga el destacado puesto', () => {
    const id = publish('A')
    boosts.grant(id, 'featured', 7, NOW)
    services.setStatus(id, 'pending', NOW)

    expect(page().total).toBe(0)
  })
})

describe('lo público no filtra el trato', () => {
  test('publicView lleva featured pero no la fecha ni la clase', () => {
    const id = publish('A')
    boosts.grant(id, 'featured', 7, NOW)

    const view = services.publicView(services.byId(id) as Service)
    expect(view.featured).toBe(true)
    expect(view).not.toHaveProperty('boost_until')
    expect(view).not.toHaveProperty('boost_kind')
    expect(view).not.toHaveProperty('user_id')
  })

  test('quien publica ve hasta cuándo lo tiene en lo suyo', () => {
    const id = publish('A')
    boosts.grant(id, 'featured', 7, new Date())

    const [mine] = services.list({ user_id: userId })
    expect(mine?.boost_until).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(mine?.featured).toBe(true)
  })
})

describe('la base que ya existía', () => {
  test('las columnas se agregan sin perder lo que había', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jobit-boost-'))
    const file = join(dir, 'legacy.db')

    /* Una base de producción: `services` sin las columnas del destacado. */
    const legacy = new Database(file, { create: true })
    legacy.run(`CREATE TABLE services (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'otros', status TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`)
    legacy.run(
      "INSERT INTO services (id, user_id, title, slug, status, created_at, updated_at) VALUES ('s1', 'u1', 'Viejo', 'viejo', 'published', '2026-01-01', '2026-01-01')",
    )
    legacy.close()

    closeDb()
    process.env.DB_FILE = file
    try {
      const columns = db()
        .query<{ name: string }, []>('PRAGMA table_info(services)')
        .all()
        .map((column) => column.name)
      expect(columns).toContain('boost_until')
      expect(columns).toContain('boost_kind')

      const row = db()
        .query<{ title: string; boost_until: string }, []>(
          'SELECT title, boost_until FROM services',
        )
        .get()
      expect(row).toEqual({ title: 'Viejo', boost_until: '' })

      /* Abrirla otra vez no vuelve a agregar nada ni rompe. */
      closeDb()
      expect(db().query('SELECT COUNT(*) AS n FROM services').get()).toEqual({
        n: 1,
      })
    } finally {
      closeDb()
      process.env.DB_FILE = ':memory:'
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('admin', () => {
  const call = (path: string, init: RequestInit = {}): Promise<Response> =>
    app.handle(new Request(`http://localhost${path}`, init))

  const withCookie = (cookie: string, init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { 'Content-Type': 'application/json', cookie },
  })

  async function login(): Promise<string> {
    const response = await call('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'abrite sesamo' }),
    })
    return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  }

  test('sin sesión de admin no se otorga nada', async () => {
    const id = publish('A')
    const response = await call(`/api/admin/services/${id}/boost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'featured', days: 7 }),
    })
    expect(response.status).toBe(401)
    expect(services.byId(id)?.boost_until).toBe('')
  })

  test('otorgar, listar y revocar', async () => {
    const id = publish('A')
    const cookie = await login()

    const granted = await call(
      `/api/admin/services/${id}/boost`,
      withCookie(cookie, {
        method: 'POST',
        body: JSON.stringify({ kind: 'featured', days: 7 }),
      }),
    )
    expect(granted.status).toBe(200)
    expect(services.byId(id)?.featured).toBe(true)

    const listed = (await (
      await call('/api/admin/services/boosts', withCookie(cookie))
    ).json()) as {
      boosts: { service_id: string }[]
    }
    expect(listed.boosts.map((boost) => boost.service_id)).toEqual([id])

    const revoked = await call(
      `/api/admin/services/${id}/boost`,
      withCookie(cookie, { method: 'DELETE' }),
    )
    expect(revoked.status).toBe(200)
    expect(services.byId(id)?.featured).toBe(false)
  })

  test('un servicio inexistente es 404 y una clase o días fuera de rango, error', async () => {
    const cookie = await login()
    const ghost = await call(
      '/api/admin/services/no-existe/boost',
      withCookie(cookie, {
        method: 'POST',
        body: JSON.stringify({ kind: 'featured', days: 7 }),
      }),
    )
    expect(ghost.status).toBe(404)

    const id = publish('A')
    for (const body of [
      { kind: 'otra', days: 7 },
      { kind: 'featured', days: 0 },
      { kind: 'featured', days: 999 },
    ]) {
      const bad = await call(
        `/api/admin/services/${id}/boost`,
        withCookie(cookie, { method: 'POST', body: JSON.stringify(body) }),
      )
      expect(bad.status).toBeGreaterThanOrEqual(400)
    }
    expect(services.byId(id)?.boost_until).toBe('')
  })

  test('la ficha y la lista públicas marcan el destacado y no filtran la fecha', async () => {
    const id = publish('Electricista')
    boosts.grant(id, 'featured', 7, new Date())

    const list = (await (await call('/api/services')).json()) as {
      services: Record<string, unknown>[]
    }
    expect(list.services[0]?.featured).toBe(true)
    expect(list.services[0]).not.toHaveProperty('boost_until')

    const slug = services.byId(id)?.slug ?? ''
    const one = (await (await call(`/api/services/${slug}`)).json()) as Record<
      string,
      unknown
    >
    expect(one.featured).toBe(true)
    expect(one).not.toHaveProperty('boost_until')
  })
})
