import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { SHORTCUTS } from '../../lib/search.ts'
import { PageHeader } from '../page/PageHeader.tsx'

const SECTIONS: { name: string; what: string }[] = [
  {
    name: 'Ofertas',
    what: 'Todo lo que se publica, filtrable por rubro, zona y más. El filtro “Estado” deja solo los llamados públicos de Uruguay Concursa, por cierre.',
  },
  {
    name: 'Servicios',
    what: 'Trabajos por proyecto, para quien ofrece lo que sabe hacer.',
  },
  {
    name: 'Guardadas',
    what: 'Lo que marcaste para pensar. No es postularse. La pestaña “Seguimiento” trae lo que ya mandaste, con el estado de cada postulación.',
  },
  {
    name: 'Mercado',
    what: 'El tablero entero en números: puestos, sueldos y zonas.',
  },
  {
    name: 'Novedades',
    what: 'La campana de arriba: lo reciente que encaja con vos y los cierres que se vienen.',
  },
  {
    name: 'Perfil',
    what: 'El botón de preferencias de arriba: tus estudios, tu CV, cómo se ordena el listado, la cuenta y el borrado.',
  },
]

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-sky/50 bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/**
 * La ayuda corta: qué es JobIt, cómo se busca, los atajos y dónde vive lo que
 * la persona guarda. Es la referencia, no el tutorial paso a paso: el buscador
 * tiene su propio "?" con la misma tabla, y esto es lo general. Es una página
 * con su enlace (`?view=help`), así se puede mandar a alguien.
 */
export function HelpPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="mt-6 max-w-2xl space-y-5">
      <PageHeader
        icon={<CircleHelp aria-hidden className="size-5" />}
        lead="JobIt reúne las ofertas de trabajo de Uruguay en un solo lugar y las ordena según lo que buscás. Nada de esto hace falta aprenderlo de memoria: está acá cuando lo necesites."
        title="Ayuda"
        onBack={onBack}
      />

      <Card title="Cómo buscar">
        <p className="text-sm leading-relaxed text-muted">
          Escribí lo que buscás en el buscador (puesto, empresa, ciudad o una
          palabra de la descripción) y sumá filtros con los botones. Los dos se
          combinan: el filtro acota y el texto busca.
        </p>
      </Card>

      <Card title="Atajos del buscador">
        <p className="text-sm leading-relaxed text-muted">
          Para quien los conozca, se pueden escribir directamente, combinados
          entre sí y con el texto. Por ejemplo{' '}
          <code className="rounded bg-mist px-1">
            soporte @urudata modalidad:remoto
          </code>
          .
        </p>
        <dl className="mt-3 divide-y divide-sky/40 overflow-hidden rounded-xl border border-sky/50">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.syntax}
              className="flex items-baseline gap-3 px-3 py-2"
            >
              <dt className="shrink-0 font-mono text-xs font-medium text-brand">
                {shortcut.syntax}
              </dt>
              <dd className="min-w-0 flex-1 text-right text-xs text-soft">
                {shortcut.what}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Las secciones">
        <dl className="space-y-2.5">
          {SECTIONS.map((section) => (
            <div
              key={section.name}
              className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <dt className="shrink-0 text-sm font-medium text-ink sm:w-28">
                {section.name}
              </dt>
              <dd className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
                {section.what}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Qué se guarda y dónde">
        <p className="text-sm leading-relaxed text-muted">
          Tus preferencias, guardadas, postulaciones y perfil viven en este
          navegador, no en nuestros servidores. Si creás una cuenta y prendés la
          sincronización, esos datos también viajan cifrados para que los tengas
          en otro navegador; apagarla los borra.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Lo demás que sale son estadísticas anónimas de uso, que no llevan nada
          que te identifique.{' '}
          <a
            className="font-medium text-brand hover:opacity-80"
            href="/privacidad"
          >
            Política de privacidad
          </a>{' '}
          ·{' '}
          <a
            className="font-medium text-brand hover:opacity-80"
            href="/terminos"
          >
            Términos
          </a>
        </p>
      </Card>
    </div>
  )
}
