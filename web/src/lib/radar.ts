/**
 * Geometría del radar de los cinco rasgos. Sin React ni DOM: la usan el SVG de
 * la pantalla y el canvas del badge, así los dos dibujan exactamente lo mismo.
 */

import type { TraitKey, TraitScore } from './selfTest.ts'

export interface Point {
  x: number
  y: number
}

/** Nombres cortos para las puntas: "Estabilidad emocional" no entra en 390 px. */
export const SHORT_LABEL: Record<TraitKey, string> = {
  extroversion: 'Extroversión',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  estabilidad: 'Estabilidad',
  apertura: 'Apertura',
}

/** Los anillos de la grilla, en porcentaje de la escala. */
export const RING_LEVELS = [25, 50, 75, 100] as const

/** El primer eje apunta hacia arriba y los demás siguen en sentido horario. */
export const axisAngle = (index: number, count: number): number =>
  -Math.PI / 2 + (index * 2 * Math.PI) / count

export const polar = (center: Point, radius: number, angle: number): Point => ({
  x: center.x + radius * Math.cos(angle),
  y: center.y + radius * Math.sin(angle),
})

/** Redondeo corto para que el atributo `points` no cargue 15 decimales. */
const round = (value: number): number => Math.round(value * 100) / 100

export const toPoints = (points: Point[]): string =>
  points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')

export type Anchor = 'start' | 'middle' | 'end'

export interface RadarAxis {
  key: TraitKey
  label: string
  percent: number
  angle: number
  /** Donde termina el eje (el 100 %). */
  end: Point
  /** Donde va el punto del puntaje. */
  value: Point
  /** Donde se apoya el rótulo, afuera del anillo. */
  labelAt: Point
  anchor: Anchor
}

export interface RadarGeometry {
  center: Point
  radius: number
  axes: RadarAxis[]
  /** Un polígono por anillo, de adentro hacia afuera. */
  rings: { level: number; points: string }[]
  /** El polígono del puntaje, escalado por `progress` (0 a 1). */
  polygon: (progress?: number) => string
  /** Los puntos del puntaje, escalados por `progress`. */
  dots: (progress?: number) => Point[]
}

export interface RadarOptions {
  center: Point
  radius: number
  /** Distancia entre el anillo exterior y el rótulo. */
  labelGap?: number
}

/**
 * Cinco ejes parejos. El orden de `scores` es el de los ejes: el de `TRAITS`,
 * que es el que ya usa la lista de abajo.
 */
export function radarGeometry(
  scores: TraitScore[],
  { center, radius, labelGap = 16 }: RadarOptions,
): RadarGeometry {
  const count = scores.length
  const clamp = (percent: number): number => Math.min(100, Math.max(0, percent))

  const axes: RadarAxis[] = scores.map((score, index) => {
    const angle = axisAngle(index, count)
    const cos = Math.cos(angle)
    return {
      key: score.key,
      label: SHORT_LABEL[score.key],
      percent: score.percent,
      angle,
      end: polar(center, radius, angle),
      value: polar(center, (radius * clamp(score.percent)) / 100, angle),
      labelAt: polar(center, radius + labelGap, angle),
      anchor: cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle',
    }
  })

  const rings = RING_LEVELS.map((level) => ({
    level,
    points: toPoints(
      axes.map((axis) => polar(center, (radius * level) / 100, axis.angle)),
    ),
  }))

  const dots = (progress = 1): Point[] =>
    axes.map((axis) =>
      polar(
        center,
        (radius * clamp(axis.percent) * progress) / 100,
        axis.angle,
      ),
    )

  return {
    center,
    radius,
    axes,
    rings,
    dots,
    polygon: (progress = 1) => toPoints(dots(progress)),
  }
}

/** La misma información que el dibujo, para quien no lo ve. */
export const radarSummary = (scores: TraitScore[]): string =>
  scores
    .map((score) => `${SHORT_LABEL[score.key]} ${score.percent} de 100`)
    .join(', ')
