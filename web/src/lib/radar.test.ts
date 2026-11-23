import { describe, expect, test } from 'bun:test'
import { RING_LEVELS, axisAngle, radarGeometry, radarSummary } from './radar.ts'
import { TRAITS, type TraitScore, levelOf } from './selfTest.ts'

const scoresOf = (percents: number[]): TraitScore[] =>
  TRAITS.map((trait, index) => {
    const percent = percents[index] ?? 50
    return { key: trait.key, percent, level: levelOf(percent) }
  })

const center = { x: 100, y: 100 }
const options = { center, radius: 80 }

const distance = (point: { x: number; y: number } | undefined): number =>
  Math.hypot((point?.x ?? 0) - 100, (point?.y ?? 0) - 100)

describe('radarGeometry', () => {
  test('el primer eje apunta hacia arriba y los demás siguen en horario', () => {
    expect(axisAngle(0, 5)).toBeCloseTo(-Math.PI / 2)
    const geometry = radarGeometry(scoresOf([100, 100, 100, 100, 100]), options)
    const [first, second] = geometry.axes
    expect(first?.end.x).toBeCloseTo(100)
    expect(first?.end.y).toBeCloseTo(20)
    expect(second?.end.x).toBeGreaterThan(100)
  })

  test('100 llega al borde, 0 se queda en el centro y 50 a la mitad', () => {
    const geometry = radarGeometry(scoresOf([100, 0, 50, 100, 0]), options)
    expect(distance(geometry.axes[0]?.value)).toBeCloseTo(80)
    expect(distance(geometry.axes[1]?.value)).toBeCloseTo(0)
    expect(distance(geometry.axes[2]?.value)).toBeCloseTo(40)
  })

  test('un puntaje fuera de rango no se sale del anillo exterior', () => {
    const geometry = radarGeometry(scoresOf([250, -30, 50, 50, 50]), options)
    expect(distance(geometry.axes[0]?.value)).toBeCloseTo(80)
    expect(distance(geometry.axes[1]?.value)).toBeCloseTo(0)
  })

  test('el progreso achica el polígono hacia el centro', () => {
    const geometry = radarGeometry(scoresOf([100, 100, 100, 100, 100]), options)
    expect(
      geometry
        .polygon(0)
        .split(' ')
        .every((point) => point === '100,100'),
    ).toBe(true)
    expect(geometry.polygon(1)).toBe(geometry.polygon())
    expect(geometry.dots(0.5)[0]?.y).toBeCloseTo(60)
  })

  test('hay un anillo por nivel y cada uno tiene un vértice por rasgo', () => {
    const geometry = radarGeometry(scoresOf([10, 20, 30, 40, 50]), options)
    expect(geometry.rings.map((ring) => ring.level)).toEqual([...RING_LEVELS])
    for (const ring of geometry.rings) {
      expect(ring.points.split(' ')).toHaveLength(5)
    }
  })

  test('los rótulos de la izquierda se alinean al final y los de la derecha al inicio', () => {
    const geometry = radarGeometry(scoresOf([50, 50, 50, 50, 50]), options)
    expect(geometry.axes.map((axis) => axis.anchor)).toEqual([
      'middle',
      'start',
      'start',
      'end',
      'end',
    ])
  })
})

describe('radarSummary', () => {
  test('nombra los cinco rasgos con su puntaje', () => {
    const text = radarSummary(scoresOf([10, 20, 30, 40, 50]))
    expect(text).toContain('Extroversión 10 de 100')
    expect(text).toContain('Apertura 50 de 100')
    expect(text.split(', ')).toHaveLength(5)
  })
})
