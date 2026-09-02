import { RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { fadeUpTransition } from "../lib/motion.ts";

interface DangerZoneProps {
  /** What is about to be lost, listed so the confirmation is informed. */
  counts: { saved: number; applications: number; dismissed: number; preferences: number };
  onResetPreferences: () => void;
  onEraseEverything: () => void;
}

type Pending = "reset" | "erase" | null;

/**
 * Two steps, always. The first click says what exactly is going to disappear
 * and the second one does it: these are the only buttons in the app that
 * destroy something, and there is no server-side copy to restore from.
 */
function Confirm({
  open,
  title,
  losing,
  action,
  tone,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  losing: ReactNode;
  action: string;
  tone: "warn" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          transition={fadeUpTransition}
        >
          <div className="mt-2 rounded-xl border border-onpanel/20 bg-onpanel/10 px-3 py-3">
            <p className="flex gap-2 text-[11px] leading-relaxed font-medium text-onpanel">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky" />
              {title}
            </p>
            <div className="mt-2 pl-5.5 text-[11px] leading-relaxed text-onpanel/70">{losing}</div>

            <div className="mt-3 flex gap-2 pl-5.5">
              <button
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  tone === "danger"
                    ? "bg-onpanel text-panel hover:bg-onpanel/85"
                    : "bg-sky text-ink hover:bg-sky/85"
                }`}
                type="button"
                onClick={onConfirm}
              >
                {action}
              </button>
              <button
                className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-onpanel/60 transition-colors hover:bg-onpanel/10 hover:text-onpanel"
                type="button"
                onClick={onCancel}
              >
                Cancelar
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function DangerZone({ counts, onResetPreferences, onEraseEverything }: DangerZoneProps) {
  const [pending, setPending] = useState<Pending>(null);

  const ask = (which: Exclude<Pending, null>) =>
    setPending((current) => (current === which ? null : which));

  const run = (action: () => void) => {
    action();
    setPending(null);
  };

  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

  return (
    <div className="space-y-3 border-t border-onpanel/10 pt-3">
      <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">
        Borrar datos
      </p>

      <div>
        <button
          aria-expanded={pending === "reset"}
          className="inline-flex w-full items-center gap-2 rounded-lg bg-onpanel/10 px-2.5 py-2 text-left text-[11px] font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
          type="button"
          onClick={() => ask("reset")}
        >
          <RotateCcw aria-hidden className="size-3.5 shrink-0" />
          Reiniciar el algoritmo y las preferencias
        </button>

        <Confirm
          action="Sí, reiniciar"
          losing={
            <>
              Se borran {plural(counts.preferences, "preferencia", "preferencias")}: rubros, zonas,
              sueldo, modalidad, lo que ocultaste y las fuentes elegidas. La lista vuelve a
              ordenarse por fecha.
              <br />
              <strong className="font-medium text-onpanel/90">
                Tu perfil, tus guardadas y tu seguimiento no se tocan.
              </strong>
            </>
          }
          open={pending === "reset"}
          title="¿Reiniciar cómo se ordenan las ofertas?"
          tone="warn"
          onCancel={() => setPending(null)}
          onConfirm={() => run(onResetPreferences)}
        />
      </div>

      <div>
        <button
          aria-expanded={pending === "erase"}
          className="inline-flex w-full items-center gap-2 rounded-lg bg-onpanel/10 px-2.5 py-2 text-left text-[11px] font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
          type="button"
          onClick={() => ask("erase")}
        >
          <Trash2 aria-hidden className="size-3.5 shrink-0" />
          Borrar todos mis datos de este navegador
        </button>

        <Confirm
          action="Sí, borrar todo"
          losing={
            <>
              Se borra todo lo que JobIt guarda acá: tu perfil y tus estudios,{" "}
              {plural(counts.saved, "oferta guardada", "ofertas guardadas")},{" "}
              {plural(counts.applications, "postulación seguida", "postulaciones seguidas")},{" "}
              {plural(counts.dismissed, "oferta descartada", "ofertas descartadas")} y todas tus
              preferencias.
              <br />
              <strong className="font-medium text-onpanel/90">
                No hay copia en ningún servidor: esto no se puede deshacer.
              </strong>{" "}
              Vas a arrancar de cero con el onboarding.
            </>
          }
          open={pending === "erase"}
          title="¿Borrar todo y empezar de cero?"
          tone="danger"
          onCancel={() => setPending(null)}
          onConfirm={() => run(onEraseEverything)}
        />
      </div>
    </div>
  );
}
