import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'

process.env.DB_FILE = ':memory:'

const { closeDb, db } = await import('./db.ts')
const { migrateMetrics } = await import('./db-metrics.ts')
const { appendEvents } = await import('./events.ts')
const metrics = await import('./metrics.ts')
const alerts = await import('./alerts.ts')
const exported = await import('./metrics-export.ts')

const NOW = new Date('2026-03-31T12:00:00Z')
const TODAY = '2026-03-31'

beforeEach(() => {
  closeDb()
})

function addCompany(id = 'c1', name = 'Acme'): string {
  const stamp = NOW.toISOString()
  db().run(
    `INSERT INTO companies (id, name, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, `slug-${id}`, stamp, stamp],
  )
  return id
}

function addOffer(
  id: string,
  companyId = 'c1',
  options: { category?: string; published?: string; status?: string } = {},
): string {
  const stamp = NOW.toISOString()
  db().run(
    `INSERT INTO offers (id, company_id, title, category, status, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      companyId,
      `Oferta ${id}`,
      options.category ?? 'tecnologia',
      options.status ?? 'published',
      stamp,
      stamp,
      options.published ?? '2026-01-01T00:00:00Z',
    ],
  )
  return id
}

function addEmail(
  companyId: string,
  kind: string,
  email: string,
  verified = 1,
) {
  const stamp = NOW.toISOString()
  db().run(
    `INSERT INTO company_emails (company_id, kind, email, verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [companyId, kind, email, verified, stamp, stamp],
  )
}

function setDay(
  offerId: string,
  day: string,
  counts: { views?: number; clicks?: number; applies?: number },
) {
  db().run(
    `INSERT INTO offer_daily (offer_id, day, views, clicks, applies)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(offer_id, day) DO UPDATE SET
       views = excluded.views, clicks = excluded.clicks, applies = excluded.applies`,
    [offerId, day, counts.views ?? 0, counts.clicks ?? 0, counts.applies ?? 0],
  )
}

describe('migración de clicks', () => {
  function oldDatabase(): Database {
    const old = new Database(':memory:')
    old.run('CREATE TABLE offers (id TEXT PRIMARY KEY)')
    old.run(`CREATE TABLE offer_daily (
      offer_id TEXT NOT NULL REFERENCES offers(id),
      day TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      applies INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (offer_id, day)
    )`)
    old.run('CREATE TABLE companies (id TEXT PRIMARY KEY)')
    old.run("INSERT INTO offers (id) VALUES ('o1')")
    old.run("INSERT INTO offer_daily VALUES ('o1', '2026-03-01', 10, 4)")
    old.run("INSERT INTO offer_daily VALUES ('o1', '2026-03-02', 3, 0)")
    return old
  }

  const rows = (database: Database) =>
    database
      .query<
        { day: string; views: number; clicks: number; applies: number },
        []
      >('SELECT day, views, clicks, applies FROM offer_daily ORDER BY day')
      .all()

  test('lo que contaba el clic pasa a clicks y applies vuelve a cero', () => {
    const old = oldDatabase()
    migrateMetrics(old)
    expect(rows(old)).toEqual([
      { day: '2026-03-01', views: 10, clicks: 4, applies: 0 },
      { day: '2026-03-02', views: 3, clicks: 0, applies: 0 },
    ])
  })

  test('corre una sola vez: reiniciar no vuelve a mover números', () => {
    const old = oldDatabase()
    migrateMetrics(old)
    old.run("UPDATE offer_daily SET applies = 2 WHERE day = '2026-03-01'")
    migrateMetrics(old)
    expect(rows(old)[0]).toEqual({
      day: '2026-03-01',
      views: 10,
      clicks: 4,
      applies: 2,
    })
  })

  test('crea las tablas de alertas', () => {
    const old = oldDatabase()
    migrateMetrics(old)
    const names = old
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      )
      .all()
      .map((row) => row.name)
    expect(names).toContain('company_alert_settings')
    expect(names).toContain('alert_sent')
  })
})

describe('eventos', () => {
  test('offer_click suma al contador clicks y no a applies', async () => {
    addCompany()
    addOffer('o1')
    await appendEvents([
      { kind: 'offer_view', id: 'o1' },
      { kind: 'offer_click', id: 'o1' },
      { kind: 'offer_click', id: 'o1' },
      { kind: 'offer_apply', id: 'o1' },
    ])
    const report = metrics.companyMetrics('c1', 7)
    expect(report.views).toBe(1)
    expect(report.clicks).toBe(2)
    expect(report.applies).toBe(1)
  })

  test('un clic a una oferta que no es propia no rompe el lote', async () => {
    expect(await appendEvents([{ kind: 'offer_click', id: 'no-existe' }])).toBe(
      0,
    )
  })
})

describe('ventanas comparables', () => {
  test('el período anterior mide lo mismo y termina antes de la ventana', () => {
    addCompany()
    addOffer('o1')
    const report = metrics.companyMetrics('c1', 7, NOW)
    expect(report.from).toBe('2026-03-25')
    expect(report.to).toBe(TODAY)
    expect(report.previous.from).toBe('2026-03-18')
    expect(report.previous.to).toBe('2026-03-24')
    expect(report.previous.daily).toHaveLength(7)
  })

  test('con datos antes, da la variación y el porcentaje', () => {
    addCompany()
    addOffer('o1')
    setDay('o1', '2026-03-20', { views: 10, clicks: 2, applies: 1 })
    setDay('o1', '2026-03-28', { views: 15, clicks: 2, applies: 0 })

    const report = metrics.companyMetrics('c1', 7, NOW)
    expect(report.previous.has_data).toBe(true)
    expect(report.views).toBe(15)
    expect(report.previous.views).toBe(10)
    expect(report.change.views).toEqual({ previous: 10, delta: 5, pct: 50 })
    expect(report.change.clicks.pct).toBe(0)
    expect(report.change.applies).toEqual({ previous: 1, delta: -1, pct: -100 })
  })

  test('sin datos antes no inventa una variación', () => {
    addCompany()
    addOffer('o1')
    setDay('o1', '2026-03-28', { views: 15 })

    const report = metrics.companyMetrics('c1', 7, NOW)
    expect(report.previous.has_data).toBe(false)
    expect(report.change.views.pct).toBeNull()
    expect(report.change.views.delta).toBe(15)
  })

  test('change() no divide por cero', () => {
    expect(metrics.change(5, 0)).toEqual({ previous: 0, delta: 5, pct: null })
    expect(metrics.change(0, 0)).toEqual({ previous: 0, delta: 0, pct: null })
    expect(metrics.change(3, 4)).toEqual({ previous: 4, delta: -1, pct: -25 })
  })

  test('lo que cae fuera de las dos ventanas no cuenta', () => {
    addCompany()
    addOffer('o1')
    setDay('o1', '2026-03-10', { views: 99 })
    const report = metrics.companyMetrics('c1', 7, NOW)
    expect(report.views).toBe(0)
    expect(report.previous.views).toBe(0)
    expect(report.previous.has_data).toBe(false)
  })
})

describe('embudo', () => {
  test('por oferta y por rubro, con lo anterior al lado', () => {
    addCompany()
    addOffer('o1', 'c1', { category: 'tecnologia' })
    addOffer('o2', 'c1', { category: 'tecnologia' })
    addOffer('o3', 'c1', { category: 'ventas' })
    setDay('o1', '2026-03-28', { views: 20, clicks: 5, applies: 2 })
    setDay('o2', '2026-03-28', { views: 10, clicks: 1, applies: 0 })
    setDay('o3', '2026-03-28', { views: 4, clicks: 0, applies: 0 })
    setDay('o1', '2026-03-20', { views: 8, clicks: 2, applies: 1 })

    const report = metrics.companyMetrics('c1', 7, NOW)

    expect(report.by_offer.map((offer) => offer.id)).toEqual(['o1', 'o2', 'o3'])
    expect(report.by_offer[0]).toMatchObject({
      views: 20,
      clicks: 5,
      applies: 2,
      previous: { views: 8, clicks: 2, applies: 1 },
    })

    const tech = report.by_category.find((entry) => entry.key === 'tecnologia')
    expect(tech).toMatchObject({
      offers: 2,
      views: 30,
      clicks: 6,
      applies: 2,
      previous: { views: 8, clicks: 2, applies: 1 },
    })
    expect(report.by_category.map((entry) => entry.key)).toEqual([
      'tecnologia',
      'ventas',
    ])
  })

  test('nunca cruza empresas', () => {
    addCompany('c1')
    addCompany('c2', 'Beta')
    addOffer('o1', 'c1')
    addOffer('o2', 'c2')
    setDay('o2', '2026-03-28', { views: 50 })
    const report = metrics.companyMetrics('c1', 7, NOW)
    expect(report.views).toBe(0)
    expect(report.by_offer.map((offer) => offer.id)).toEqual(['o1'])
  })
})

describe('exportación', () => {
  test('el CSV trae resumen, días, ofertas y rubros bajo un encabezado', () => {
    addCompany()
    addOffer('o1', 'c1', { category: 'tecnologia' })
    setDay('o1', '2026-03-28', { views: 15, clicks: 3, applies: 1 })

    const csv = exported.metricsCsv(metrics.companyMetrics('c1', 7, NOW))
    const lines = csv.trim().split(/\r?\n/)
    expect(lines[0]).toBe(exported.METRICS_COLUMNS.join(','))
    expect(csv).toContain('resumen,2026-03-25..2026-03-31')
    expect(csv).toContain('diario,2026-03-28')
    expect(csv).toContain('oferta,o1,Oferta o1,publicada,15,3,1')
    expect(csv).toContain('rubro,tecnologia')
  })

  test('sin período anterior las columnas *_anterior quedan vacías, no en cero', () => {
    addCompany()
    addOffer('o1')
    setDay('o1', '2026-03-28', { views: 15 })

    const tables = exported.metricsTables(metrics.companyMetrics('c1', 7, NOW))
    const summary = tables[0]!.rows[0]!
    expect(summary.slice(4, 7)).toEqual([15, 0, 0])
    expect(summary.slice(7)).toEqual([null, null, null])
  })

  test('con período anterior las columnas *_anterior traen su número', () => {
    addCompany()
    addOffer('o1')
    setDay('o1', '2026-03-20', { views: 10, clicks: 2, applies: 1 })
    setDay('o1', '2026-03-28', { views: 15 })

    const tables = exported.metricsTables(metrics.companyMetrics('c1', 7, NOW))
    expect(tables[0]!.rows[0]!.slice(7)).toEqual([10, 2, 1])
  })

  test('el XLSX trae una pestaña por tabla, sin la columna tabla ni las vacías', () => {
    addCompany()
    addOffer('o1')
    setDay('o1', '2026-03-28', { views: 15 })

    const sheets = exported.metricsSheets(metrics.companyMetrics('c1', 7, NOW))
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      'resumen',
      'diario',
      'oferta',
      'rubro',
    ])
    const header = sheets[0]!.rows[0]!
    expect(header).not.toContain('tabla')
    expect(header).not.toContain('vistas_anterior')
    expect(header).toContain('vistas')
  })

  test('el nombre del archivo lleva el largo y el último día', () => {
    addCompany()
    const report = metrics.companyMetrics('c1', 30, NOW)
    expect(exported.metricsFilename(report, 'csv')).toBe(
      'jobit-metricas-30d-2026-03-31.csv',
    )
  })
})

describe('detección de alertas', () => {
  const offer = (
    daily: { day: string; views?: number; clicks?: number; applies?: number }[],
    overrides: Partial<{ status: string; published_at: string }> = {},
  ): Parameters<typeof alerts.detectAlerts>[0][number] => ({
    id: 'o1',
    title: 'Backend',
    status: 'published',
    published_at: '2026-01-01T00:00:00Z',
    ...overrides,
    daily: daily.map((point) => ({
      views: 0,
      clicks: 0,
      applies: 0,
      ...point,
    })),
  })

  test('pico de vistas sin clics ni postulaciones', () => {
    const found = alerts.detectAlerts(
      [
        offer([
          { day: '2026-03-28', views: 2 },
          { day: '2026-03-30', views: 30 },
        ]),
      ],
      TODAY,
    )
    expect(found.map((alert) => alert.kind)).toEqual(['views_no_applies'])
    expect(found[0]!.detail).toContain('30 vistas')
  })

  test('el pico con un clic en los últimos días no alerta', () => {
    const found = alerts.detectAlerts(
      [
        offer([
          { day: '2026-03-29', clicks: 1 },
          { day: '2026-03-30', views: 30 },
        ]),
      ],
      TODAY,
    )
    expect(found).toEqual([])
  })

  test('debajo del mínimo de vistas es ruido', () => {
    const found = alerts.detectAlerts(
      [offer([{ day: '2026-03-30', views: 9 }])],
      TODAY,
    )
    expect(found).toEqual([])
  })

  test('un día alto en una oferta que siempre tuvo mucho no es un pico', () => {
    const steady = ['24', '25', '26', '27', '28', '29'].map((day) => ({
      day: `2026-03-${day}`,
      views: 20,
    }))
    const found = alerts.detectAlerts(
      [offer([...steady, { day: '2026-03-30', views: 30 }])],
      TODAY,
    )
    expect(found).toEqual([])
  })

  test('hoy no cuenta: se mira hasta ayer, que ya está completo', () => {
    const found = alerts.detectAlerts(
      [
        offer([
          { day: '2026-03-26', views: 1 },
          { day: TODAY, views: 80 },
        ]),
      ],
      TODAY,
    )
    expect(found).toEqual([])
  })

  test('publicada hace días y sin ninguna vista', () => {
    const found = alerts.detectAlerts([offer([])], TODAY)
    expect(found.map((alert) => alert.kind)).toEqual(['no_visits'])
  })

  test('una oferta recién publicada no alerta por no haber tenido tiempo', () => {
    const found = alerts.detectAlerts(
      [offer([], { published_at: '2026-03-29T10:00:00Z' })],
      TODAY,
    )
    expect(found).toEqual([])
  })

  test('una sola vista en la semana alcanza para no avisar', () => {
    const found = alerts.detectAlerts(
      [offer([{ day: '2026-03-26', views: 1 }])],
      TODAY,
    )
    expect(found).toEqual([])
  })

  test('borradores y archivadas no se vigilan', () => {
    expect(
      alerts.detectAlerts([offer([], { status: 'draft' })], TODAY),
    ).toEqual([])
    expect(
      alerts.detectAlerts([offer([], { status: 'archived' })], TODAY),
    ).toEqual([])
  })
})

describe('el disparador', () => {
  function ok() {
    const sent: { to: string; subject: string; text: string }[] = []
    const send = async (mail: {
      to: string
      subject: string
      text: string
    }) => {
      sent.push(mail)
      return { ok: true as const, value: undefined }
    }
    return { sent, send }
  }

  /** Una empresa con una oferta publicada hace meses que nadie abre. */
  function silentCompany() {
    addCompany()
    addOffer('o1')
    addEmail('c1', 'contact', 'rrhh@acme.com')
  }

  test('manda un correo con la oferta y es idempotente el mismo día', async () => {
    silentCompany()
    const { sent, send } = ok()

    const first = await alerts.runAlerts(NOW, send)
    expect(first).toMatchObject({ detected: 1, mails: 1, skipped: 0 })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.to).toBe('rrhh@acme.com')
    expect(sent[0]!.text).toContain('Oferta o1')

    const second = await alerts.runAlerts(NOW, send)
    expect(second).toMatchObject({ detected: 1, mails: 0, skipped: 1 })
    expect(sent).toHaveLength(1)
  })

  test('el día siguiente con la misma situación no repite, dentro del enfriamiento', async () => {
    silentCompany()
    const { sent, send } = ok()
    await alerts.runAlerts(NOW, send)
    await alerts.runAlerts(new Date('2026-04-01T12:00:00Z'), send)
    expect(sent).toHaveLength(1)
  })

  test('pasado el enfriamiento, si sigue igual, vuelve a avisar', async () => {
    silentCompany()
    const { sent, send } = ok()
    await alerts.runAlerts(NOW, send)
    await alerts.runAlerts(new Date('2026-04-07T12:00:00Z'), send)
    expect(sent).toHaveLength(2)
  })

  test('un correo por empresa y destinatario, aunque haya varias ofertas', async () => {
    addCompany()
    addOffer('o1')
    addOffer('o2')
    addEmail('c1', 'contact', 'rrhh@acme.com')
    addEmail('c1', 'billing', 'plata@acme.com')
    const { sent, send } = ok()

    const run = await alerts.runAlerts(NOW, send)
    expect(run.detected).toBe(2)
    expect(run.mails).toBe(2)
    expect(sent.map((mail) => mail.to).sort()).toEqual([
      'plata@acme.com',
      'rrhh@acme.com',
    ])
    expect(sent[0]!.subject).toContain('2 ofertas')
  })

  test('sin correo verificado no manda nada ni reserva la alerta', async () => {
    addCompany()
    addOffer('o1')
    addEmail('c1', 'contact', 'sin-verificar@acme.com', 0)
    addEmail('c1', 'recovery', 'recupero@acme.com', 1)
    const { sent, send } = ok()

    const run = await alerts.runAlerts(NOW, send)
    expect(run).toMatchObject({ detected: 1, mails: 0, skipped: 1 })
    expect(sent).toHaveLength(0)

    addEmail('c1', 'support', 'soporte@acme.com', 1)
    const later = await alerts.runAlerts(NOW, send)
    expect(later.mails).toBe(1)
  })

  test('una empresa que apagó las alertas no recibe nada', async () => {
    silentCompany()
    alerts.setAlertsEnabled('c1', false, NOW)
    const { sent, send } = ok()

    const run = await alerts.runAlerts(NOW, send)
    expect(run).toMatchObject({ companies: 0, detected: 0, mails: 0 })
    expect(sent).toHaveLength(0)

    alerts.setAlertsEnabled('c1', true, NOW)
    expect((await alerts.runAlerts(NOW, send)).mails).toBe(1)
  })

  test('si el envío falla, la reserva se suelta y el próximo intento reintenta', async () => {
    silentCompany()
    const failing = async () => ({ ok: false as const, error: 'sin red' })
    const failed = await alerts.runAlerts(NOW, failing as never)
    expect(failed.mails).toBe(0)

    const { sent, send } = ok()
    const retry = await alerts.runAlerts(NOW, send)
    expect(retry.mails).toBe(1)
    expect(sent).toHaveLength(1)
  })

  test('las alertas son por oferta de cada empresa, nunca cruzadas', async () => {
    addCompany('c1')
    addCompany('c2', 'Beta')
    addOffer('o1', 'c1')
    addOffer('o2', 'c2')
    setDay('o2', '2026-03-28', { views: 3 })
    addEmail('c1', 'contact', 'rrhh@acme.com')
    addEmail('c2', 'contact', 'rrhh@beta.com')
    const { sent, send } = ok()

    await alerts.runAlerts(NOW, send)
    expect(sent.map((mail) => mail.to)).toEqual(['rrhh@acme.com'])
  })

  test('el correo dice cómo apagar los avisos y no guarda quién miró', () => {
    const mail = alerts.alertMail(
      { name: 'Acme' },
      [
        {
          offer_id: 'o1',
          title: 'Backend',
          kind: 'no_visits',
          detail: 'Nadie la abrió en los últimos 7 días.',
        },
      ],
      'rrhh@acme.com',
    )
    expect(mail.subject).toContain('Acme')
    expect(mail.text).toContain('apagar')
    expect(mail.text).toContain('Backend')
  })
})
