import { Camera, Trash2 } from 'lucide-react'
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react'
import {
  CENTERED,
  type Crop,
  cropRect,
  encodePhoto,
  photoError,
} from '../../lib/photo.ts'
import { panelButtonClass } from './PanelControls.tsx'

interface PhotoFieldProps {
  /** Data URL guardado, o vacío. */
  value: string
  onChange: (photo: string) => void
}

const PREVIEW = 176

interface Source {
  image: HTMLImageElement
  width: number
  height: number
}

/**
 * La foto del CV. Se elige, se encuadra con tres deslizadores y se guarda ya
 * cuadrada y comprimida: el archivo original no se guarda ni sale del
 * navegador, y al pasar por el canvas pierde también la ubicación y los datos
 * de cámara que traía.
 */
export function PhotoField({ value, onChange }: PhotoFieldProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [crop, setCrop] = useState<Crop>(CENTERED)
  const [error, setError] = useState('')

  /* El preview se redibuja con cada cambio del encuadre. */
  useEffect(() => {
    const canvas = preview.current
    if (!source || !canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const { sx, sy, size } = cropRect(source.width, source.height, crop)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, PREVIEW, PREVIEW)
    context.drawImage(source.image, sx, sy, size, size, 0, 0, PREVIEW, PREVIEW)
  }, [source, crop])

  const close = () => {
    setSource(null)
    setCrop(CENTERED)
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const problem = photoError(file)
    if (problem) {
      setError(problem)
      return
    }

    setError('')
    const url = URL.createObjectURL(file)
    const image = new Image()
    /* La URL sólo hace falta hasta que el navegador decodifica la imagen:
       después se dibuja desde el elemento, así que se libera enseguida. */
    image.onload = () => {
      URL.revokeObjectURL(url)
      setCrop(CENTERED)
      setSource({
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      setError('No pude abrir esa foto. Probá con otra.')
    }
    image.src = url
  }

  const save = () => {
    if (!source) return
    const photo = encodePhoto(source.image, source.width, source.height, crop)
    if (photo === '') {
      setError('No pude procesar la foto en este navegador.')
      return
    }
    onChange(photo)
    close()
  }

  const slider = (
    label: string,
    key: keyof Crop,
    min: number,
    max: number,
    step: number,
  ) => (
    <div>
      <label
        className="text-[11px] font-medium text-onpanel/75"
        htmlFor={`${id}-${key}`}
      >
        {label}
      </label>
      <input
        className="mt-1 block min-h-11 w-full accent-sky sm:min-h-6"
        id={`${id}-${key}`}
        max={max}
        min={min}
        step={step}
        type="range"
        value={crop[key]}
        onChange={(event) =>
          setCrop((current) => ({
            ...current,
            [key]: Number(event.target.value),
          }))
        }
      />
    </div>
  )

  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
        Foto
      </p>

      <input
        ref={input}
        accept="image/jpeg,image/png,image/webp"
        aria-label="Elegir una foto"
        className="sr-only"
        id={`${id}-file`}
        tabIndex={-1}
        type="file"
        onChange={onFile}
      />

      {source ? (
        <div className="mt-2 space-y-3">
          <canvas
            ref={preview}
            aria-label="Vista previa de la foto"
            className="size-44 rounded-full bg-onpanel-wash"
            height={PREVIEW}
            role="img"
            width={PREVIEW}
          />
          {slider('Acercar', 'zoom', 1, 4, 0.05)}
          {slider('Mover a los costados', 'x', -1, 1, 0.02)}
          {slider('Mover arriba y abajo', 'y', -1, 1, 0.02)}
          <div className="flex flex-wrap gap-1.5">
            <button
              className={`${panelButtonClass} bg-sky text-ink hover:bg-sky hover:text-ink`}
              type="button"
              onClick={save}
            >
              Usar esta foto
            </button>
            <button className={panelButtonClass} type="button" onClick={close}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          {value ? (
            <img
              alt="Tu foto"
              className="size-16 shrink-0 rounded-full object-cover"
              height={64}
              src={value}
              width={64}
            />
          ) : (
            <span
              aria-hidden
              className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-onpanel-wash text-onpanel-faint"
            >
              <Camera className="size-6" />
            </span>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              className={panelButtonClass}
              type="button"
              onClick={() => input.current?.click()}
            >
              <Camera aria-hidden className="size-3.5" />
              {value ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {value ? (
              <button
                className={panelButtonClass}
                type="button"
                onClick={() => onChange('')}
              >
                <Trash2 aria-hidden className="size-3.5" />
                Quitar
              </button>
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-2 text-[11px] text-onpanel" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-relaxed text-onpanel-faint">
        La recortás y se achica acá mismo. La original no se guarda y nada se
        sube.
      </p>
    </div>
  )
}
