import { describe, expect, test } from 'bun:test'
import { CENTERED, cropRect, photoError } from './photo.ts'

describe('cropRect', () => {
  test('con zoom 1 toma el cuadrado más grande, centrado', () => {
    expect(cropRect(800, 600, CENTERED)).toEqual({ sx: 100, sy: 0, size: 600 })
    expect(cropRect(600, 800, CENTERED)).toEqual({ sx: 0, sy: 100, size: 600 })
  })

  test('el desplazamiento mueve el cuadrado por el lado largo', () => {
    expect(cropRect(800, 600, { zoom: 1, x: -1, y: 0 }).sx).toBe(0)
    expect(cropRect(800, 600, { zoom: 1, x: 1, y: 0 }).sx).toBe(200)
  })

  test('con zoom el cuadrado se achica y también se mueve en el lado corto', () => {
    const rect = cropRect(800, 600, { zoom: 2, x: 1, y: 1 })
    expect(rect.size).toBe(300)
    expect(rect.sx).toBe(500)
    expect(rect.sy).toBe(300)
  })

  test('nunca se sale de la imagen, pase lo que pase con los valores', () => {
    for (const crop of [
      { zoom: 0, x: -5, y: 9 },
      { zoom: 99, x: 9, y: -9 },
      { zoom: 1.7, x: 0.3, y: -0.4 },
    ]) {
      const { sx, sy, size } = cropRect(1000, 700, crop)
      expect(sx).toBeGreaterThanOrEqual(0)
      expect(sy).toBeGreaterThanOrEqual(0)
      expect(sx + size).toBeLessThanOrEqual(1000)
      expect(sy + size).toBeLessThanOrEqual(700)
    }
  })
})

describe('photoError', () => {
  const file = (type: string, size = 1000) =>
    ({ type, size }) as unknown as File

  test('acepta JPG, PNG y WebP', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp'])
      expect(photoError(file(type))).toBeNull()
  })

  test('rechaza lo que no es una imagen que sirva o es enorme', () => {
    expect(photoError(file('application/pdf'))).not.toBeNull()
    expect(photoError(file('image/svg+xml'))).not.toBeNull()
    expect(photoError(file('image/jpeg', 20 * 1024 * 1024))).not.toBeNull()
  })
})
