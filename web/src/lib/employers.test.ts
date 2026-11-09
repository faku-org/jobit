import { describe, expect, test } from 'bun:test'
import { employerPagePath, employerSlug, isWorkedAt } from './employers.ts'

describe('isWorkedAt', () => {
  const slugs = new Set(['acme-s-a', 'telefonica'])

  test('coincide por slug normalizado, sin mayúsculas ni acentos', () => {
    expect(isWorkedAt('ACME S.A.', slugs)).toBe(true)
    expect(isWorkedAt('  acme   s a ', slugs)).toBe(true)
    expect(isWorkedAt('Telefónica', slugs)).toBe(true)
  })

  test('usa el mismo slug que guarda el stand en prefs.companies', () => {
    expect(
      isWorkedAt('Telefónica', new Set([employerSlug('Telefónica')])),
    ).toBe(true)
  })

  test('otra empresa, sin empresa o sin cargadas: no marca', () => {
    expect(isWorkedAt('Otra', slugs)).toBe(false)
    expect(isWorkedAt(null, slugs)).toBe(false)
    expect(isWorkedAt(undefined, slugs)).toBe(false)
    expect(isWorkedAt('', slugs)).toBe(false)
    expect(isWorkedAt('ACME S.A.', new Set())).toBe(false)
  })

  test('un nombre que no deja slug no marca', () => {
    expect(isWorkedAt('!!!', new Set(['']))).toBe(false)
  })
})

describe('employerPagePath', () => {
  test('escapa el slug', () => {
    expect(employerPagePath('acme-s-a')).toBe('/empresa/acme-s-a')
    expect(employerPagePath('a/b')).toBe('/empresa/a%2Fb')
  })
})
