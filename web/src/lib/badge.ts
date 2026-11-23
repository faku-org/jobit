/**
 * El badge del resultado del test: una imagen para guardar o compartir.
 *
 * Todo pasa en el navegador. La imagen se dibuja en un canvas, se convierte en
 * PNG en memoria y de ahí va al sistema de compartir, al portapapeles o a una
 * descarga. No hay ninguna llamada a la API ni ningún evento con el resultado:
 * lo que se muestra en la imagen solo sale si la persona lo manda a alguien.
 */

import { radarGeometry } from './radar.ts'
import { TRAITS, type TraitScore, levelPhrase } from './selfTest.ts'

export const BADGE_WIDTH = 1080
export const BADGE_HEIGHT = 1350
export const BADGE_FILE_NAME = 'jobit-mi-perfil-laboral.png'
export const BADGE_SITE = 'jobs.wefaber.net'

/**
 * Colores del badge. La imagen sale de la app y se ve en cualquier fondo, así
 * que no sigue el tema de quien la genera: es siempre la paleta azul de la
 * marca (`ink`, `brand` y `sky` del tema claro) con texto blanco.
 */
export const BADGE_PALETTE = {
  top: '#0d47a1',
  bottom: '#082f6e',
  glow: '#2196f3',
  text: '#ffffff',
  muted: 'rgba(255, 255, 255, 0.78)',
  ring: 'rgba(144, 202, 249, 0.28)',
  frame: 'rgba(144, 202, 249, 0.38)',
  fill: 'rgba(100, 181, 246, 0.36)',
  stroke: '#90caf9',
} as const

export interface BadgeModel {
  /** El rasgo más alto; si empatan, el primero según el orden del test. */
  top: TraitScore
  traitLabel: string
  phrase: string
  scores: TraitScore[]
  /** La descripción para quien no ve la imagen. */
  alt: string
}

export function badgeModel(scores: TraitScore[]): BadgeModel | null {
  let top: TraitScore | undefined
  for (const score of scores) {
    if (!top || score.percent > top.percent) top = score
  }
  if (!top) return null

  const trait = TRAITS.find((entry) => entry.key === top.key)
  const traitLabel = trait?.label ?? top.key
  const phrase = levelPhrase(top)

  return {
    top,
    traitLabel,
    phrase,
    scores,
    alt: `Mi perfil laboral en JobIt. Lo que más se nota en mí: ${traitLabel}, ${top.percent} de 100. ${phrase}.`,
  }
}

const FONT_FALLBACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

type Ctx = CanvasRenderingContext2D

/** Achica el texto hasta que entre en `maxWidth`, sin pasar de `size`. */
function fitFont(
  ctx: Ctx,
  text: string,
  weight: number,
  size: number,
  family: string,
  maxWidth: number,
): void {
  let current = size
  ctx.font = `${weight} ${current}px ${family}`
  while (current > 24 && ctx.measureText(text).width > maxWidth) {
    current -= 2
    ctx.font = `${weight} ${current}px ${family}`
  }
}

/** Dibuja el badge completo sobre un canvas de `BADGE_WIDTH` × `BADGE_HEIGHT`. */
export function drawBadge(
  ctx: Ctx,
  model: BadgeModel,
  family: string = FONT_FALLBACK,
): void {
  const palette = BADGE_PALETTE
  const width = BADGE_WIDTH
  const height = BADGE_HEIGHT
  const margin = 84

  ctx.save()
  ctx.clearRect(0, 0, width, height)

  /* Fondo: azul de la marca, con una luz suave detrás del radar. */
  const background = ctx.createLinearGradient(0, 0, 0, height)
  background.addColorStop(0, palette.top)
  background.addColorStop(1, palette.bottom)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(540, 820, 40, 540, 820, 560)
  glow.addColorStop(0, 'rgba(33, 150, 243, 0.45)')
  glow.addColorStop(1, 'rgba(33, 150, 243, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  /* Marco fino: la única decoración. */
  ctx.strokeStyle = palette.frame
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(36, 36, width - 72, height - 72, 44)
  ctx.stroke()

  /* Marca y nombre del test. */
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = palette.text
  ctx.textAlign = 'left'
  ctx.font = `800 64px ${family}`
  ctx.fillText('JobIt', margin, 148)

  ctx.textAlign = 'right'
  ctx.fillStyle = palette.muted
  ctx.font = `500 30px ${family}`
  ctx.fillText('Test de autoconocimiento', width - margin, 146)

  /* El rasgo que más se nota. */
  ctx.textAlign = 'left'
  ctx.fillStyle = palette.muted
  ctx.font = `600 30px ${family}`
  ctx.fillText('Lo que más se nota en mí', margin, 272)

  ctx.fillStyle = palette.text
  fitFont(ctx, model.traitLabel, 800, 96, family, width - margin * 2)
  ctx.fillText(model.traitLabel, margin, 372)

  ctx.fillStyle = palette.muted
  ctx.font = `500 40px ${family}`
  ctx.fillText(`${model.phrase} · ${model.top.percent} de 100`, margin, 436)

  /* El radar chico, con los mismos datos que el de la pantalla. */
  const geometry = radarGeometry(model.scores, {
    center: { x: width / 2, y: 840 },
    radius: 270,
    labelGap: 44,
  })

  const trace = (points: { x: number; y: number }[]) => {
    ctx.beginPath()
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.closePath()
  }

  ctx.strokeStyle = palette.ring
  ctx.lineWidth = 2
  for (const level of [0.25, 0.5, 0.75, 1]) {
    trace(
      geometry.axes.map((axis) => ({
        x: geometry.center.x + (axis.end.x - geometry.center.x) * level,
        y: geometry.center.y + (axis.end.y - geometry.center.y) * level,
      })),
    )
    ctx.stroke()
  }
  for (const axis of geometry.axes) {
    ctx.beginPath()
    ctx.moveTo(geometry.center.x, geometry.center.y)
    ctx.lineTo(axis.end.x, axis.end.y)
    ctx.stroke()
  }

  const dots = geometry.dots()
  trace(dots)
  ctx.fillStyle = palette.fill
  ctx.fill()
  ctx.strokeStyle = palette.stroke
  ctx.lineWidth = 5
  ctx.lineJoin = 'round'
  ctx.stroke()

  dots.forEach((dot, index) => {
    const highlighted = geometry.axes[index]?.key === model.top.key
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, highlighted ? 14 : 9, 0, Math.PI * 2)
    ctx.fillStyle = highlighted ? palette.text : palette.stroke
    ctx.fill()
  })

  ctx.font = `600 30px ${family}`
  ctx.fillStyle = palette.text
  ctx.textBaseline = 'middle'
  for (const axis of geometry.axes) {
    ctx.textAlign = axis.anchor === 'middle' ? 'center' : axis.anchor
    /* Arriba y abajo el rótulo se corre un poco para no pisar el anillo. */
    const nudge = Math.sin(axis.angle) * 10
    ctx.fillText(axis.label, axis.labelAt.x, axis.labelAt.y + nudge)
  }

  /* Pie: el aviso va en la imagen, no solo en la pantalla. */
  ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = palette.ring
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margin, 1198)
  ctx.lineTo(width - margin, 1198)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.fillStyle = palette.text
  ctx.font = `600 30px ${family}`
  ctx.fillText('No es un psicotécnico ni un diagnóstico.', margin, 1252)
  ctx.fillStyle = palette.muted
  ctx.font = `500 28px ${family}`
  ctx.fillText('Una guía para conocerme mejor.', margin, 1294)

  ctx.textAlign = 'right'
  ctx.fillStyle = palette.text
  ctx.font = `700 30px ${family}`
  ctx.fillText(BADGE_SITE, width - margin, 1294)

  ctx.restore()
}

/** El PNG del badge, armado en memoria. */
export function renderBadge(model: BadgeModel, family?: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = BADGE_WIDTH
  canvas.height = BADGE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('canvas-unavailable'))
  drawBadge(ctx, model, family)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('png-failed'))),
      'image/png',
    )
  })
}

/* ---------------------------------------------------------------------------
 * Compartir
 * ------------------------------------------------------------------------ */

export type BadgeShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled'

export interface ShareEnv {
  /** `navigator.canShare({ files })`; falso donde no existe. */
  canShareFile: (file: File) => boolean
  share: (data: { files: File[]; title: string; text: string }) => Promise<void>
  copyImage: (blob: Blob) => Promise<void>
  download: (blob: Blob, name: string) => void
}

const isAbort = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'

/**
 * El camino de "Compartir": el menú del sistema con el archivo si el navegador
 * puede; si no, la imagen al portapapeles; si tampoco, se descarga. Cerrar el
 * menú sin elegir nada no es un error ni dispara otro camino.
 */
export async function shareBadge(
  blob: Blob,
  text: string,
  env: ShareEnv,
): Promise<BadgeShareResult> {
  const file = new File([blob], BADGE_FILE_NAME, { type: 'image/png' })

  if (env.canShareFile(file)) {
    try {
      await env.share({ files: [file], title: 'Mi perfil laboral', text })
      return 'shared'
    } catch (error) {
      if (isAbort(error)) return 'cancelled'
      /* Un fallo que no es cancelar se trata como "no se pudo compartir" y
         cae a las alternativas de abajo. */
    }
  }

  try {
    await env.copyImage(blob)
    return 'copied'
  } catch {
    env.download(blob, BADGE_FILE_NAME)
    return 'downloaded'
  }
}

/** El entorno real del navegador. */
export function browserShareEnv(): ShareEnv {
  return {
    canShareFile: (file) =>
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' &&
      navigator.canShare({ files: [file] }),
    share: (data) => navigator.share(data),
    copyImage: async (blob) => {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('clipboard-unavailable')
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
    },
    download: downloadBlob,
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  /* Se suelta después de un rato: algunos navegadores arrancan la descarga
     recién en el turno siguiente. */
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
