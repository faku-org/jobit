import { describe, expect, test } from 'bun:test'
import { EMPTY_PROFILE } from './profile.ts'
import {
  EMPTY_RESUME,
  MAX_LANGUAGES,
  buildExport,
  exportFileName,
  filtersFromSearch,
  levelFromText,
  linkKindOf,
  mergeReading,
  normalizeUrl,
  resumeCount,
  sanitizeResume,
} from './resume.ts'
import { EMPTY_FILTERS, EMPTY_PREFERENCES } from './types.ts'

describe('normalizeUrl', () => {
  test('agrega https y saca la barra final', () => {
    expect(normalizeUrl('github.com/faku/')).toBe('https://github.com/faku')
    expect(normalizeUrl('  https://faku.dev/portfolio ')).toBe(
      'https://faku.dev/portfolio',
    )
  })

  test('solo http y https llegan a un href', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('')
    expect(normalizeUrl('data:text/html,hola')).toBe('')
    expect(normalizeUrl('ftp://x.com/a')).toBe('')
  })

  test('lo que no es una URL queda vacío', () => {
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl('mi portfolio')).toBe('')
    expect(normalizeUrl('localhost')).toBe('')
  })
})

describe('linkKindOf', () => {
  test('reconoce LinkedIn y GitHub por el dominio', () => {
    expect(linkKindOf('https://www.linkedin.com/in/faku')).toBe('linkedin')
    expect(linkKindOf('https://github.com/faku')).toBe('github')
    expect(linkKindOf('https://faku.dev')).toBe('other')
    expect(linkKindOf('https://notlinkedin.com/in/x')).toBe('other')
  })
})

describe('sanitizeResume', () => {
  test('cualquier basura da un currículum vacío', () => {
    expect(sanitizeResume(null)).toEqual(EMPTY_RESUME)
    expect(sanitizeResume('hola')).toEqual(EMPTY_RESUME)
    expect(sanitizeResume({ languages: 3, links: 'x' })).toEqual(EMPTY_RESUME)
  })

  test('idiomas: sin nombre o repetidos se descartan, nivel inválido pasa a intermedio', () => {
    const resume = sanitizeResume({
      languages: [
        { name: 'Inglés', level: 'advanced' },
        { name: 'inglés', level: 'basic' },
        { name: '', level: 'native' },
        { name: 'Portugués', level: 'experto' },
      ],
    })
    expect(resume.languages).toEqual([
      { name: 'Inglés', level: 'advanced' },
      { name: 'Portugués', level: 'intermediate' },
    ])
  })

  test('se topa la cantidad de idiomas', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      name: `Idioma ${i}`,
      level: 'basic',
    }))
    expect(sanitizeResume({ languages: many }).languages).toHaveLength(
      MAX_LANGUAGES,
    )
  })

  test('links: se normalizan, se deduplican y los peligrosos caen', () => {
    const resume = sanitizeResume({
      links: [
        { kind: 'github', url: 'github.com/faku' },
        { kind: 'other', url: 'https://github.com/faku/' },
        { kind: 'other', url: 'javascript:alert(1)' },
        { url: 'https://faku.dev' },
      ],
    })
    expect(resume.links).toEqual([
      { kind: 'github', url: 'https://github.com/faku' },
      { kind: 'other', url: 'https://faku.dev' },
    ])
  })

  test('el departamento es de la lista cerrada', () => {
    expect(sanitizeResume({ department: 'Canelones' }).department).toBe(
      'Canelones',
    )
    expect(sanitizeResume({ department: 'Atlantis' }).department).toBe('')
  })

  test('la foto solo es un data URL de imagen y de tamaño razonable', () => {
    const ok = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    expect(sanitizeResume({ photo: ok }).photo).toBe(ok)
    expect(sanitizeResume({ photo: 'https://evil.test/x.jpg' }).photo).toBe('')
    expect(
      sanitizeResume({ photo: 'data:text/html;base64,PGgxPg==' }).photo,
    ).toBe('')
    expect(
      sanitizeResume({
        photo: `data:image/jpeg;base64,${'A'.repeat(300_000)}`,
      }).photo,
    ).toBe('')
  })

  test('referencias sin nombre se descartan', () => {
    const resume = sanitizeResume({
      references: [
        { name: 'Ana', relation: 'Jefa', contact: '099 123 456' },
        { name: '  ', relation: 'x', contact: 'y' },
      ],
    })
    expect(resume.references).toEqual([
      { name: 'Ana', relation: 'Jefa', contact: '099 123 456' },
    ])
  })

  test('discapacidad: solo true cuenta, y sin la marca no queda la nota', () => {
    expect(
      sanitizeResume({ disability: { declared: 'sí', note: 'x' } }).disability,
    ).toEqual({ declared: false, note: '' })
    expect(
      sanitizeResume({ disability: { declared: true, note: ' silla ' } })
        .disability,
    ).toEqual({ declared: true, note: 'silla' })
    expect(
      sanitizeResume({ disability: { declared: false, note: 'algo' } })
        .disability.note,
    ).toBe('')
  })

  test('es idempotente', () => {
    const once = sanitizeResume({
      department: 'Salto',
      city: ' Centro ',
      lead: true,
      role: 'Cajero',
      languages: [{ name: 'Inglés', level: 'basic' }],
    })
    expect(sanitizeResume(once)).toEqual(once)
  })
})

describe('resumeCount', () => {
  test('vacío es cero, y cada bloque cargado suma', () => {
    expect(resumeCount(EMPTY_RESUME)).toBe(0)
    expect(
      resumeCount({
        ...EMPTY_RESUME,
        department: 'Rocha',
        languages: [{ name: 'Inglés', level: 'basic' }],
        lead: true,
      }),
    ).toBe(3)
  })
})

describe('mergeReading', () => {
  const found = {
    languages: [
      { name: 'Inglés', level: 'advanced' as const },
      { name: 'Portugués', level: 'basic' as const },
    ],
    links: [{ kind: 'github' as const, url: 'https://github.com/faku' }],
    place: { department: 'Canelones', city: 'Pando' },
  }

  test('suma lo nuevo sin pisar lo que la persona ya cargó', () => {
    const merged = mergeReading(
      {
        ...EMPTY_RESUME,
        department: 'Salto',
        languages: [{ name: 'Inglés', level: 'basic' }],
      },
      found,
    )
    expect(merged.languages).toEqual([
      { name: 'Inglés', level: 'basic' },
      { name: 'Portugués', level: 'basic' },
    ])
    expect(merged.department).toBe('Salto')
    expect(merged.links).toHaveLength(1)
  })

  test('completa la ubicación solo si estaba vacía', () => {
    const merged = mergeReading(EMPTY_RESUME, found)
    expect(merged.department).toBe('Canelones')
    expect(merged.city).toBe('Pando')
  })
})

describe('levelFromText', () => {
  test('palabras y niveles MCER', () => {
    expect(levelFromText('nativo')).toBe('native')
    expect(levelFromText('nivel b2')).toBe('advanced')
    expect(levelFromText('avanzado')).toBe('advanced')
    expect(levelFromText('intermedio')).toBe('intermediate')
    expect(levelFromText('basico')).toBe('basic')
    expect(levelFromText('medio horario')).toBeNull()
  })
})

describe('filtersFromSearch', () => {
  test('el puesto va al filtro de título y una sola opción por grupo filtra', () => {
    const filters = filtersFromSearch(
      { ...EMPTY_RESUME, role: 'Cajero' },
      {
        ...EMPTY_PREFERENCES,
        levels: ['entry'],
        modes: ['remote'],
        jobTypes: ['part_time'],
      },
    )
    expect(filters.title).toBe('Cajero')
    expect(filters.level).toBe('entry')
    expect(filters.mode).toBe('remote')
    expect(filters.jobType).toBe('part_time')
  })

  test('con varias opciones en un grupo ese grupo no recorta', () => {
    const filters = filtersFromSearch(EMPTY_RESUME, {
      ...EMPTY_PREFERENCES,
      levels: ['entry', 'mid'],
      modes: [],
    })
    expect(filters.level).toBe('')
    expect(filters.mode).toBe('')
  })

  test('jefatura no genera ningún filtro', () => {
    expect(
      filtersFromSearch({ ...EMPTY_RESUME, lead: true }, EMPTY_PREFERENCES),
    ).toEqual(EMPTY_FILTERS)
  })
})

describe('buildExport', () => {
  const now = new Date('2026-11-22T12:00:00Z')
  const resume = sanitizeResume({
    photo: 'data:image/jpeg;base64,/9j/4AAQ',
    department: 'Montevideo',
    role: 'Vendedor',
    lead: true,
    languages: [{ name: 'Inglés', level: 'advanced' }],
    disability: { declared: true, note: 'Uso silla de ruedas' },
  })

  test('trae lo cargado en un solo objeto', () => {
    const file = buildExport(
      { ...EMPTY_PROFILE, education: 'secondary' },
      { ...EMPTY_PREFERENCES, levels: ['entry'] },
      resume,
      now,
    ) as Record<string, any>
    expect(file.formato).toBe(1)
    expect(file.exportado).toBe('2026-11-22T12:00:00.000Z')
    expect(file.formacion.nivel).toBe('secondary')
    expect(file.busqueda.puesto).toBe('Vendedor')
    expect(file.busqueda.jefatura).toBe(true)
    expect(file.busqueda.jerarquia).toEqual(['entry'])
    expect(file.contacto.departamento).toBe('Montevideo')
    expect(file.idiomas).toHaveLength(1)
    expect(file.discapacidad.declared).toBe(true)
    expect(file.foto).toStartWith('data:image/jpeg')
  })

  test('puede dejar afuera la discapacidad aunque esté marcada', () => {
    const file = buildExport(
      EMPTY_PROFILE,
      EMPTY_PREFERENCES,
      resume,
      now,
      false,
    )
    expect('discapacidad' in file).toBe(false)
  })

  test('no exporta los ajustes que no son de la persona', () => {
    const file = JSON.stringify(
      buildExport(
        { ...EMPTY_PROFILE, shareStats: true, onboardedAt: '2026-01-01' },
        EMPTY_PREFERENCES,
        resume,
        now,
      ),
    )
    expect(file).not.toContain('shareStats')
    expect(file).not.toContain('onboardedAt')
  })

  test('el nombre del archivo lleva la fecha', () => {
    expect(exportFileName(now)).toBe('jobit-perfil-2026-11-22.json')
  })
})
