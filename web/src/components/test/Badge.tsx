import { Download, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  BADGE_FILE_NAME,
  BADGE_HEIGHT,
  BADGE_WIDTH,
  type BadgeModel,
  type BadgeShareResult,
  browserShareEnv,
  downloadBlob,
  drawBadge,
  renderBadge,
  shareBadge,
} from '../../lib/badge.ts'

const primaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-panel px-4 py-2 text-sm font-semibold text-onpanel transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const secondaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

const bodyFont = (): string | undefined =>
  getComputedStyle(document.body).fontFamily || undefined

const SHARE_TEXT = 'Mi perfil laboral, del test de autoconocimiento de JobIt.'

const MESSAGES: Record<BadgeShareResult, string> = {
  shared: 'Listo, se abrió el menú para compartir.',
  copied: 'Imagen copiada. Pegala donde quieras compartirla.',
  downloaded:
    'Tu navegador no deja compartir ni copiar: se descargó la imagen.',
  cancelled: '',
}

/**
 * El badge del resultado: una imagen vertical con el rasgo que más se nota, el
 * radar y la marca. Se dibuja en un canvas del navegador; descargar y
 * compartir trabajan sobre ese mismo dibujo. No hay red de por medio.
 */
export function Badge({ model }: { model: BadgeModel }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) drawBadge(ctx, model, bodyFont())
  }, [model])

  const download = async () => {
    if (busy) return
    setBusy(true)
    try {
      downloadBlob(await renderBadge(model, bodyFont()), BADGE_FILE_NAME)
      setStatus('Se descargó la imagen en tu dispositivo.')
    } catch {
      setStatus('No se pudo armar la imagen. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await shareBadge(
        await renderBadge(model, bodyFont()),
        SHARE_TEXT,
        browserShareEnv(),
      )
      setStatus(MESSAGES[result])
    } catch {
      setStatus('No se pudo armar la imagen. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <canvas
        ref={canvas}
        aria-label={model.alt}
        className="mx-auto block h-auto w-full max-w-72 rounded-2xl border border-sky/50 shadow-[var(--shadow-panel)]"
        height={BADGE_HEIGHT}
        role="img"
        width={BADGE_WIDTH}
      />

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button className={primaryButton} type="button" onClick={share}>
          <Share2 aria-hidden className="size-4" />
          Compartir
        </button>
        <button className={secondaryButton} type="button" onClick={download}>
          <Download aria-hidden className="size-4" />
          Descargar PNG
        </button>
      </div>

      <p
        aria-live="polite"
        className="mt-2 min-h-4 text-center text-xs text-ink"
      >
        {status}
      </p>
    </div>
  )
}
