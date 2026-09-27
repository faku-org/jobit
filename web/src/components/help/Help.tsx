import { X } from "lucide-react";
import { m } from "motion/react";
import { SHORTCUTS } from "../../lib/search.ts";
import { islandTransition } from "../../lib/motion.ts";

const SECTIONS: { name: string; what: string }[] = [
  { name: "Ofertas", what: "Todo lo que se publica, filtrable por rubro, zona y más." },
  { name: "Estado", what: "Los llamados públicos de Uruguay Concursa, por cierre." },
  { name: "Guardadas", what: "Lo que marcaste para pensar. No es postularse." },
  { name: "Seguimiento", what: "Lo que ya mandaste, con el estado de cada postulación." },
  { name: "Mercado", what: "El tablero entero en números: puestos, sueldos y zonas." },
  { name: "Novedades", what: "Lo reciente que encaja con vos, y los cierres que se vienen." },
];

/**
 * La ayuda corta: qué es JobIt, cómo se busca, los atajos y dónde vive lo que
 * la persona guarda. Es la referencia, no el tutorial paso a paso: el buscador
 * tiene su propio "?" con la misma tabla, y esto es lo general.
 */
export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-70 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <m.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="help-title"
        aria-modal
        className="relative flex max-h-[85svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] sm:rounded-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        transition={islandTransition}
      >
        <header className="flex items-center justify-between gap-3 border-b border-sky/40 px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink" id="help-title">
            Ayuda
          </h2>
          <button
            aria-label="Cerrar"
            className="rounded-lg p-1 text-muted transition-colors hover:text-ink"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-relaxed text-soft">
            JobIt reúne las ofertas de trabajo de Uruguay en un solo lugar y las ordena según lo que
            buscás. Nada de esto hace falta aprenderlo de memoria: está acá cuando lo necesites.
          </p>

          <section>
            <h3 className="text-xs font-semibold tracking-tight text-ink">Cómo buscar</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Escribí lo que buscás en el buscador (puesto, empresa, ciudad o una palabra de la
              descripción) y sumá filtros con los botones. Los dos se combinan: el filtro acota y el
              texto busca.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold tracking-tight text-ink">Atajos del buscador</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Para quien los conozca, se pueden escribir directamente, combinados entre sí y con el
              texto. Por ejemplo{" "}
              <code className="rounded bg-mist px-1">soporte @urudata modalidad:remoto</code>.
            </p>
            <dl className="mt-2 divide-y divide-sky/40 overflow-hidden rounded-xl border border-sky/50">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.syntax} className="flex items-baseline gap-3 px-3 py-2">
                  <dt className="shrink-0 font-mono text-xs font-medium text-brand">
                    {shortcut.syntax}
                  </dt>
                  <dd className="min-w-0 flex-1 text-right text-xs text-soft">{shortcut.what}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold tracking-tight text-ink">Las secciones</h3>
            <dl className="mt-2 space-y-1.5">
              {SECTIONS.map((section) => (
                <div key={section.name} className="flex items-baseline gap-3">
                  <dt className="w-24 shrink-0 text-xs font-medium text-ink">{section.name}</dt>
                  <dd className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
                    {section.what}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-sky/50 bg-canvas px-3.5 py-3">
            <h3 className="text-xs font-semibold tracking-tight text-ink">Qué se guarda y dónde</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Tus preferencias, guardadas, postulaciones y perfil viven en este navegador, no en
              nuestros servidores. Si creás una cuenta y prendés la sincronización, esos datos
              también viajan cifrados para que los tengas en otro navegador; apagarla los borra.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Lo demás que sale son estadísticas anónimas de uso, que no llevan nada que te
              identifique.{" "}
              <a className="font-medium text-brand hover:opacity-80" href="/privacidad">
                Política de privacidad
              </a>{" "}
              ·{" "}
              <a className="font-medium text-brand hover:opacity-80" href="/terminos">
                Términos
              </a>
            </p>
          </section>
        </div>
      </m.div>
    </div>
  );
}
