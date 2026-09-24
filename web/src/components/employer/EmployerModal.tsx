import { Briefcase, Check, MapPin, Target, X } from "lucide-react";
import { m } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { type EmployerProfile, fetchEmployer } from "../../lib/employers.ts";
import { islandTransition } from "../../lib/motion.ts";
import { chipClass, iconButtonClass, mutedChip } from "../../lib/styles.ts";

interface EmployerModalProps {
  slug: string;
  label: string;
  /** Si la empresa está entre las que la persona marcó como suyas. */
  worked: boolean;
  onToggleWorked: () => void;
  /** Filtra el tablero a esta empresa. */
  onFilter: () => void;
  onClose: () => void;
}

const MODE_LABEL: Record<string, string> = {
  onsite: "Presencial",
  remote: "Remoto",
  hybrid: "Híbrido",
};

const pesos = (value: number): string => `$ ${value.toLocaleString("es-UY")}`;

function Row({ items }: { items: { label: string; count: number }[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item.label} className={mutedChip}>
          {item.label}
          <span className="tabular-nums opacity-60">{item.count}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * El stand de una empresa: su foto (cuánto publica, cuánto paga, qué puestos
 * pide, dónde) y sus últimas ofertas. Es una vista sobre el tablero, sin dato
 * de nadie, así que se puede compartir.
 */
export function EmployerModal({
  slug,
  label,
  worked,
  onToggleWorked,
  onFilter,
  onClose,
}: EmployerModalProps) {
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const controller = new AbortController();
    fetchEmployer(slug, controller.signal)
      .then(setProfile)
      .catch(() => {});
    return () => controller.abort();
  }, [slug]);

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

  const salary = profile?.salary ?? null;

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
        aria-labelledby="employer-modal-title"
        aria-modal
        className="relative flex max-h-[92svh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] sm:max-h-[85svh] sm:rounded-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        transition={islandTransition}
        onAnimationComplete={() => {
          if (closing) onClose();
        }}
      >
        <header className="flex items-start gap-3 border-b border-sky/40 px-4 py-4 sm:px-5">
          <span
            aria-hidden
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"
          >
            <Briefcase className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="text-[17px] leading-snug font-semibold tracking-tight text-ink"
              id="employer-modal-title"
            >
              {profile?.label ?? label}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {profile
                ? `${profile.count} oferta${profile.count === 1 ? "" : "s"} publicada${profile.count === 1 ? "" : "s"}`
                : "Cargando…"}
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {profile ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <span className={`${chipClass} bg-mist text-soft`}>
                  <MapPin aria-hidden className="size-3.5" />
                  {profile.departments[0]?.value ?? "Uruguay"}
                </span>
                {profile.modes.map((mode) => (
                  <span key={mode.value} className={mutedChip}>
                    {MODE_LABEL[mode.value] ?? mode.value}
                    <span className="tabular-nums opacity-60">{mode.count}</span>
                  </span>
                ))}
                {profile.noExperience > 0 ? (
                  <span className={mutedChip}>
                    Sin experiencia
                    <span className="tabular-nums opacity-60">{profile.noExperience}</span>
                  </span>
                ) : null}
              </div>

              {salary ? (
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Sueldo publicado
                  </h3>
                  <p className="mt-1 text-sm text-ink">
                    mediana <strong className="font-semibold">{pesos(salary.median)}</strong>
                    <span className="text-muted">
                      {" "}
                      · {pesos(salary.min)} a {pesos(salary.max)} · {salary.count}{" "}
                      {salary.count === 1 ? "aviso" : "avisos"}
                    </span>
                  </p>
                </section>
              ) : null}

              {profile.roles.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Puestos más pedidos
                  </h3>
                  <div className="mt-2">
                    <Row
                      items={profile.roles.map((role) => ({
                        label: role.label,
                        count: role.count,
                      }))}
                    />
                  </div>
                </section>
              ) : null}

              {profile.categories.length > 1 ? (
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Rubros
                  </h3>
                  <div className="mt-2">
                    <Row
                      items={profile.categories.map((entry) => ({
                        label: entry.label,
                        count: entry.count,
                      }))}
                    />
                  </div>
                </section>
              ) : null}

              <p className="text-[11px] leading-relaxed text-faint">
                Es lo que JobIt ve en sus ofertas; no hay dato de empleados ni de la empresa por
                fuera del tablero.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Buscando las ofertas de esta empresa…</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-sky/40 bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-4">
          <button
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              worked ? "bg-brand/15 text-ink" : "border border-sky/60 text-muted hover:text-ink"
            }`}
            type="button"
            onClick={onToggleWorked}
          >
            <Check aria-hidden className="size-4" />
            {worked ? "Ya trabajé acá" : "¿Trabajaste acá?"}
          </button>
          <button
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel transition-colors hover:bg-brand"
            type="button"
            onClick={onFilter}
          >
            <Target aria-hidden className="size-4" />
            Ver solo sus ofertas
          </button>
        </div>
      </m.div>
    </div>
  );
}
