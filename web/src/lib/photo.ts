/** Lado de la foto que se guarda. Alcanza para un CV y pesa decenas de KB. */
export const PHOTO_SIZE = 400
export const PHOTO_QUALITY = 0.82
/** Una foto de celular puede pesar 10 MB; más que esto ni se intenta leer. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024

export interface Crop {
  /** 1 = el cuadrado más grande que entra; 3 = la tercera parte de eso. */
  zoom: number
  /** -1 (todo a un lado) a 1 (todo al otro), 0 centrado. */
  x: number
  y: number
}

export const CENTERED: Crop = { zoom: 1, x: 0, y: 0 }

export interface SourceRect {
  sx: number
  sy: number
  size: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * El cuadrado de la imagen original que queda adentro del recorte. Con zoom 1
 * es el cuadrado más grande que entra, y el desplazamiento mueve ese cuadrado
 * por el lado largo; con más zoom el cuadrado se achica y se puede mover
 * también por el lado corto. Nunca se sale de la imagen.
 */
export function cropRect(
  width: number,
  height: number,
  crop: Crop,
): SourceRect {
  const zoom = clamp(crop.zoom, 1, 4)
  const size = Math.min(width, height) / zoom
  const roomX = width - size
  const roomY = height - size
  return {
    sx: (roomX / 2) * (1 + clamp(crop.x, -1, 1)),
    sy: (roomY / 2) * (1 + clamp(crop.y, -1, 1)),
    size,
  }
}

/** Lo que se le muestra a quien sube algo que no es una imagen que sirva. */
export const photoError = (file: File): string | null => {
  if (!/^image\/(?:jpeg|png|webp)$/.test(file.type))
    return 'Usá una foto JPG, PNG o WebP.'
  if (file.size > MAX_SOURCE_BYTES)
    return 'Esa foto pesa demasiado. Probá con otra.'
  return null
}

/**
 * Recorta y comprime en el navegador. La foto original nunca se guarda ni se
 * manda a ningún lado: sólo queda el resultado, ya cuadrado y chico. Al pasar
 * por un canvas se pierden también los metadatos (ubicación, cámara) que traía.
 */
export function encodePhoto(
  image: CanvasImageSource,
  width: number,
  height: number,
  crop: Crop,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_SIZE
  canvas.height = PHOTO_SIZE
  const context = canvas.getContext('2d')
  if (!context) return ''
  const { sx, sy, size } = cropRect(width, height, crop)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE)
  context.drawImage(image, sx, sy, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
}
