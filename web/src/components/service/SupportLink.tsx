import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchSupportUrl } from '../../lib/services.ts'

/**
 * Apoyo voluntario: un enlace a una página de afuera, sin cuenta y sin
 * seguimiento. Abrirlo no manda ningún evento y no se guarda quién lo tocó.
 *
 * El texto dice lo que hay y lo que no: no desbloquea nada. Si apoyar diera
 * algo a cambio dejaría de ser apoyo y pasaría a ser un plan pago.
 */
export function SupportLink() {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchSupportUrl(controller.signal)
      .then(setUrl)
      .catch(() => {})
    return () => controller.abort()
  }, [])

  if (!url) return null

  return (
    <aside className="rounded-2xl border border-dashed border-sky bg-surface/60 px-5 py-4 text-sm text-soft">
      <p>
        Publicar en JobIt es gratis y no vende tu información. Si querés, podés
        apoyar el proyecto. No te da nada a cambio: ni distintivo, ni lugar en
        la lista.
      </p>
      <a
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky/70 bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Heart aria-hidden className="size-4 text-brand" />
        Apoyar a JobIt
      </a>
    </aside>
  )
}
