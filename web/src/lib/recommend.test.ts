import { describe, expect, test } from 'bun:test'
import { EMPTY_PROFILE, type Profile } from './profile.ts'
import {
  WEIGHTS,
  cardReasons,
  missingReasons,
  recommender,
} from './recommend.ts'
import { EMPTY_RESUME } from './resume.ts'
import { derivedSkills, ownedSkills, withOwnedSkills } from './skills.ts'
import { EMPTY_PREFERENCES, type Job, type Preferences } from './types.ts'

const prefs = (overrides: Partial<Preferences> = {}): Preferences => ({
  ...EMPTY_PREFERENCES,
  ...overrides,
})

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  ...EMPTY_PROFILE,
  ...overrides,
})

const job = (overrides: Partial<Job> = {}): Job => ({
  id: 'a',
  source: 'buscojobs',
  source_id: '1',
  title: 'Puesto',
  company: 'X',
  department: 'Montevideo',
  city: 'Montevideo',
  category: 'tecnologia',
  category_label: 'Tecnología',
  date_posted: '2026-08-01T00:00:00',
  level: null,
  remote: null,
  job_type: null,
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: 1,
  closes_at: null,
  description: '',
  requirements: null,
  apply_url: 'https://ejemplo.uy/1',
  duplicates: [],
  ...overrides,
})

const run = (
  offer: Job,
  preferences: Preferences = prefs(),
  person: Profile = profile(),
) => recommender(preferences, person, null)(offer)

describe('recommender: perfil vacío', () => {
  test('sin preferencias ni perfil no hay puntos ni razones', () => {
    const result = run(job({ description: 'Se pide React y Excel' }))
    expect(result.score).toBe(0)
    expect(result.reasons).toEqual([])
  })

  test('sin habilidades cargadas no se castiga por las que faltan', () => {
    const result = run(job({ requirements: 'Excel y React' }))
    expect(missingReasons(result)).toEqual([])
    expect(result.score).toBe(0)
  })
})

describe('recommender: preferencias', () => {
  test('rubro y zona suman con su frase', () => {
    const result = run(
      job(),
      prefs({ categories: ['tecnologia'], departments: ['Montevideo'] }),
    )
    expect(result.score).toBe(WEIGHTS.category + WEIGHTS.department)
    expect(result.reasons.map((entry) => entry.text)).toEqual([
      'Es de Tecnología, tu rubro',
      'Es en Montevideo, tu zona',
    ])
  })

  test('una oferta que no coincide no suma nada', () => {
    const result = run(
      job({ department: 'Salto' }),
      prefs({ departments: ['Montevideo'] }),
    )
    expect(result.score).toBe(0)
  })
})

describe('recommender: habilidades', () => {
  test('una habilidad que pide la oferta y tiene la persona suma y dice de dónde sale', () => {
    const manual = run(
      job({ requirements: 'Manejo de React' }),
      prefs(),
      profile({ skills: ['react'] }),
    )
    expect(manual.score).toBe(WEIGHTS.skill)
    expect(manual.reasons[0]?.text).toBe('Pide React, que sumaste a tu perfil')

    const fromCv = run(
      job({ requirements: 'Inglés intermedio' }),
      prefs(),
      profile({ courses: ['ingles-basico'] }),
    )
    expect(fromCv.reasons[0]?.text).toBe('Pide Inglés, que está en tu CV')
  })

  test('las habilidades que faltan restan y se listan aparte', () => {
    const result = run(
      job({ requirements: 'Excel y SQL' }),
      prefs(),
      profile({ skills: ['excel'] }),
    )
    expect(result.score).toBe(WEIGHTS.skill + WEIGHTS.skillMissing)
    expect(missingReasons(result).map((entry) => entry.text)).toEqual([
      'Pide Bases de datos / SQL y no lo tenés cargado',
    ])
  })

  test('las habilidades quitadas del CV no cuentan, las sumadas a mano sí', () => {
    const person = profile({
      courses: ['ingles-basico'],
      skillsOff: ['ingles'],
    })
    expect(derivedSkills(person, null)).toEqual([])
    expect(
      ownedSkills({ ...person, skills: ['ingles'] }, null).map(
        (skill) => skill.source,
      ),
    ).toEqual(['manual'])
  })

  test('el puesto del CV aporta habilidades', () => {
    const resume = { ...EMPTY_RESUME, role: 'Desarrollador React' }
    const score = recommender(
      prefs(),
      profile(),
      resume,
    )(job({ title: 'Dev React' })).score
    expect(score).toBe(WEIGHTS.skill)
  })

  test('el tope de coincidencias evita que una lista larga se lleve todo', () => {
    const result = run(
      job({ requirements: 'Excel, Word, SQL, Python, React' }),
      prefs(),
      profile({ skills: ['excel', 'word', 'sql', 'python', 'react'] }),
    )
    expect(result.score).toBe(WEIGHTS.skill * WEIGHTS.skillCap)
  })

  test('las razones de la tarjeta son pocas y solo positivas', () => {
    const result = run(
      job({ requirements: 'Excel y SQL' }),
      prefs({ categories: ['tecnologia'], departments: ['Montevideo'] }),
      profile({ skills: ['excel'] }),
    )
    const shown = cardReasons(result)
    expect(shown).toHaveLength(2)
    expect(shown.every((entry) => entry.kind === 'plus')).toBe(true)
    expect(shown[0]?.points).toBe(WEIGHTS.category)
  })
})

describe('recommender: experiencia y estudios', () => {
  test('nivel corto: pide más años de los que tiene la persona', () => {
    const result = run(
      job({ experience_years_min: 3 }),
      prefs(),
      profile({ experienceYears: 2 }),
    )
    expect(result.score).toBe(WEIGHTS.experienceShort)
    expect(result.reasons[0]?.kind).toBe('minus')
    expect(result.reasons[0]?.text).toBe('Pide 3 años y tenés 2 años')
  })

  test('cumple los años que pide', () => {
    const result = run(
      job({ experience_years_min: 2 }),
      prefs(),
      profile({ experienceYears: 5 }),
    )
    expect(result.score).toBe(WEIGHTS.experience)
  })

  test('una oferta sin experiencia le sirve a quien está arrancando', () => {
    const starting = run(
      job({ no_experience: true }),
      prefs(),
      profile({ experienceYears: 0 }),
    )
    expect(starting.reasons[0]?.text).toBe('No pide experiencia previa')

    const veteran = run(
      job({ no_experience: true }),
      prefs(),
      profile({ experienceYears: 8 }),
    )
    expect(veteran.score).toBe(0)
  })

  test('el nivel se compara con los años solo si la oferta no dice años', () => {
    const far = run(
      job({ level: 'senior' }),
      prefs(),
      profile({ experienceYears: 0 }),
    )
    expect(far.score).toBe(WEIGHTS.levelFar)

    const explicit = run(
      job({ level: 'senior', experience_years_min: 1 }),
      prefs(),
      profile({ experienceYears: 0 }),
    )
    expect(explicit.reasons.map((entry) => entry.id)).toEqual(['experience'])
  })

  test('los estudios que no alcanzan restan y los que alcanzan suman', () => {
    const asks = job({ education_level: 'Terciario' })
    expect(run(asks, prefs(), profile({ education: 'primary' })).score).toBe(
      WEIGHTS.educationShort,
    )
    expect(run(asks, prefs(), profile({ education: 'university' })).score).toBe(
      WEIGHTS.education,
    )
  })
})

describe('recommender: orden', () => {
  test('el puntaje es la suma de las razones y estas vienen de mayor a menor peso', () => {
    const result = run(
      job({ requirements: 'Excel', experience_years_min: 1 }),
      prefs({ categories: ['tecnologia'] }),
      profile({ skills: ['excel'], experienceYears: 3 }),
    )
    expect(result.score).toBe(
      result.reasons.reduce((sum, entry) => sum + entry.points, 0),
    )
    const weights = result.reasons.map((entry) => Math.abs(entry.points))
    expect(weights).toEqual([...weights].sort((a, b) => b - a))
  })
})

describe('withOwnedSkills', () => {
  test('sumar y quitar a mano no deja basura ni borra lo que sale del CV sin avisar', () => {
    const person = profile({ courses: ['ingles-basico'] })
    const added = withOwnedSkills(person, null, ['ingles', 'react'])
    expect(added.skills).toEqual(['react'])
    expect(added.skillsOff).toEqual([])

    const removedManual = withOwnedSkills(added, null, ['ingles'])
    expect(removedManual.skills).toEqual([])

    const removedCv = withOwnedSkills(person, null, [])
    expect(removedCv.skillsOff).toEqual(['ingles'])
    expect(ownedSkills(removedCv, null)).toEqual([])

    const back = withOwnedSkills(removedCv, null, ['ingles'])
    expect(back.skills).toEqual(['ingles'])
    expect(back.skillsOff).toEqual([])
  })
})
