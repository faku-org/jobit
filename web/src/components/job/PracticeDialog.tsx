import { GraduationCap, X } from "lucide-react";
import { m } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { islandTransition } from "../../lib/motion.ts";
import { iconButtonClass } from "../../lib/styles.ts";
import { ALL_PREP_KINDS, usePrep } from "../../hooks/usePrep.ts";
import { PrepTips } from "./PrepTips.tsx";

interface PracticeDialogProps {
  /** La oferta que se acaba de seguir, para el subtítulo. */
  title: string;
  category: string;
  label: string;
  practiceAlways: boolean;
  onPracticeAlwaysChange: (value: boolean) => void;
  onClose: () => void;
}

/**
 * Lo que aparece al confirmar una postulación: las preguntas y los ejercicios
 * del rubro para prepararse, y la casilla para que vuelva a aparecer la próxima
 * vez. Se abre solo cuando hay algo que mostrar; si el rubro todavía no tiene
 * contenido, lo dice sin dejar un hueco.
 */
export function PracticeDialog({
  title,
  category,
  label,
  practiceAlways,
  onPracticeAlwaysChange,
  onClose,
}: PracticeDialogProps) {
  const prep = usePrep(category, true, ALL_PREP_KINDS);
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return (
    <div className="fixed inset-0 z-70 flex items-end justify-center sm:items-center sm:p-6">
      <m.div
        animate={{ opacity: closing ? 0 : 1 }}
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        onClick={close}
      />

      <m.div
        animate={closing ? { opacity: 0, y: 24, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="practice-dialog-title"
        aria-modal
        className="relative flex max-h-[92svh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] sm:max-h-[85svh] sm:rounded-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        transition={islandTransition}
        onAnimationComplete={() => {
          if (closing) onClose();
        }}
      >
        <header className="flex items-start gap-3 border-b border-sky/40 px-5 py-4">
          <span
            aria-hidden
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"
          >
            <GraduationCap className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="text-[17px] leading-snug font-semibold tracking-tight text-ink"
              id="practice-dialog-title"
            >
              Ya la seguís. ¿Practicamos?
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted">
              {label ? `${label} · ` : ""}
              {title}
            </p>
          </div>
          <m.button
            aria-label="Cerrar"
            className={iconButtonClass}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={close}
          >
            <X aria-hidden className="size-4" />
          </m.button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {prep.status === "loading" ? (
            <p className="text-sm text-muted">Buscando ejercicios y preguntas de tu rubro…</p>
          ) : prep.items.length > 0 ? (
            <PrepTips items={prep.items} />
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              Todavía no tenemos preguntas ni ejercicios para este rubro. Cuando los tengamos, van a
              aparecer acá y en la ficha de la oferta.
            </p>
          )}
        </div>

        <div className="border-t border-sky/40 bg-surface px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              checked={practiceAlways}
              className="mt-0.5 size-4 shrink-0 accent-brand"
              type="checkbox"
              onChange={(event) => onPracticeAlwaysChange(event.target.checked)}
            />
            <span className="text-xs leading-relaxed text-soft">
              Mostrar ejercicios siempre al postular. También podés practicar cuando quieras desde{" "}
              <strong className="font-medium text-ink">Seguimiento</strong>.
            </span>
          </label>
        </div>
      </m.div>
    </div>
  );
}
