import { Clock3, Flag, Laptop, MapPin, UserRound, Wallet, X } from "lucide-react";
import { m } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { islandTransition } from "../../lib/motion.ts";
import {
  type ReportReason,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  RESPONSE_TIME_LABEL,
  type Service,
  WORK_STYLE_LABEL,
  basePrice,
  extraPrices,
  formatPrice,
  formatServiceDay,
  hoursByDay,
  reportService,
  serviceCategoryLabel,
  serviceLocation,
  serviceModeLabel,
} from "../../lib/services.ts";
import { serviceShare } from "../../lib/share.ts";
import { chipClass, iconButtonClass, menuItemClass, mutedChip } from "../../lib/styles.ts";
import { ShareMenu } from "../ui/ShareMenu.tsx";
import { Reviews } from "./Reviews.tsx";

interface ServiceModalProps {
  service: Service;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function PriceRow({ price }: { price: ReturnType<typeof basePrice> }) {
  if (!price) return null;

  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-sm text-ink/80">
        {price.label || "Precio"}
        {price.notes ? <span className="block text-xs text-muted">{price.notes}</span> : null}
      </span>
      <span className="shrink-0 text-sm font-medium text-ink tabular-nums">
        {formatPrice(price)}
      </span>
    </li>
  );
}

/** Lo que se denuncia y lo que no: una lista corta, sin caja de texto. Nadie
 * tiene que contar su caso para avisar que algo no va. */
function ReportMenu({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const send = (reason: ReportReason) => {
    setOpen(false);
    setSent(true);
    void reportService(service.slug, reason).catch(() => {});
  };

  if (sent) {
    return <p className="text-xs text-muted">Gracias: alguien lo va a mirar.</p>;
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-ink"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Flag aria-hidden className="size-3.5" />
        Denunciar
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-40 mb-1 w-56 rounded-xl border border-sky/60 bg-surface p-1 shadow-[var(--shadow-panel)]">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              className={menuItemClass}
              type="button"
              onClick={() => send(reason)}
            >
              {REPORT_REASON_LABEL[reason]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * El servicio entero en una hoja, con el mismo patrón que la ficha de una
 * oferta: precios, extras, horarios, características, calificación y quién
 * está atrás.
 */
export function ServiceModal({ service, onClose }: ServiceModalProps) {
  /** La hoja juega su propia salida y recién después pide que la desmonten. */
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);

  const price = basePrice(service);
  const extras = extraPrices(service);
  const days = hoursByDay(service.hours);
  const features: string[] = [
    serviceCategoryLabel(service),
    serviceModeLabel(service),
    WORK_STYLE_LABEL[service.work_style] ?? "",
    RESPONSE_TIME_LABEL[service.response_time] ?? "",
    service.experience_years === null
      ? ""
      : service.experience_years === 1
        ? "1 año de experiencia"
        : `${service.experience_years} años de experiencia`,
    service.fixed_price ? "Precio cerrado" : "Precio a convenir",
  ].filter(Boolean);

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
    <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-6">
      <m.div
        animate={{ opacity: closing ? 0 : 1 }}
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        onClick={close}
      />

      <m.div
        animate={closing ? { opacity: 0, y: 24, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="service-modal-title"
        aria-modal
        className="relative flex h-[100svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] sm:h-auto sm:max-h-[85svh] sm:rounded-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        transition={islandTransition}
        onAnimationComplete={() => {
          if (closing) onClose();
        }}
      >
        {/* Igual que la ficha de una oferta: en el teléfono el título va a lo
            ancho y las acciones bajan a su propia fila. */}
        <header className="flex flex-col gap-3 border-b border-sky/40 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
          <div className="min-w-0 flex-1">
            <h2
              className="text-[19px] leading-snug font-semibold tracking-tight text-ink"
              id="service-modal-title"
            >
              {service.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-soft">
              <span className="inline-flex items-center gap-1.5">
                <UserRound aria-hidden className="size-3.5 shrink-0 text-brand" />
                {service.owner_name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="size-3.5 shrink-0 text-brand" />
                {serviceLocation(service)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5">
            <ShareMenu target={serviceShare(service)} />
            <m.button
              aria-label="Cerrar"
              className={iconButtonClass}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={close}
            >
              <X aria-hidden className="size-4" />
            </m.button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${chipClass} bg-sky/40 text-ink`}>
              <Laptop aria-hidden className="size-3.5" />
              {serviceModeLabel(service)}
            </span>
            {price ? (
              <span className={`${chipClass} bg-wash text-ink`}>
                <Wallet aria-hidden className="size-3.5" />
                {formatPrice(price)}
              </span>
            ) : (
              <span className={mutedChip}>Precio a convenir</span>
            )}
            {RESPONSE_TIME_LABEL[service.response_time] ? (
              <span className={mutedChip}>
                <Clock3 aria-hidden className="size-3.5" />
                {RESPONSE_TIME_LABEL[service.response_time]}
              </span>
            ) : null}
          </div>

          {service.description ? (
            <Section title="Qué hace">
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink/85">
                {service.description}
              </p>
            </Section>
          ) : service.summary ? (
            <Section title="Qué hace">
              <p className="text-sm leading-relaxed text-ink/85">{service.summary}</p>
            </Section>
          ) : null}

          {service.skills.length > 0 ? (
            <Section title="Habilidades">
              <div className="flex flex-wrap gap-1.5">
                {service.skills.map((skill) => (
                  <span key={skill} className={`${chipClass} bg-mist text-soft`}>
                    {skill}
                  </span>
                ))}
              </div>
            </Section>
          ) : null}

          {price ? (
            <Section title="Precios">
              <ul className="space-y-2 rounded-xl border border-sky/50 px-3 py-3">
                {service.prices
                  .filter((entry) => entry.kind === "base")
                  .map((entry, index) => (
                    <PriceRow key={`${entry.label}-${index}`} price={entry} />
                  ))}
              </ul>
              {!service.fixed_price ? (
                <p className="mt-2 text-xs text-muted">
                  El precio es de referencia: se termina de acordar con la persona.
                </p>
              ) : null}
            </Section>
          ) : null}

          {extras.length > 0 ? (
            <Section title="Extras">
              <ul className="space-y-2 rounded-xl border border-sky/50 px-3 py-3">
                {extras.map((entry, index) => (
                  <PriceRow key={`${entry.label}-${index}`} price={entry} />
                ))}
              </ul>
            </Section>
          ) : null}

          {days.length > 0 ? (
            <Section title="Horarios">
              <ul className="space-y-1.5">
                {days.map((day) => (
                  <li key={day.weekday} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink/80">{day.label}</span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {day.ranges.join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
              {service.availability_note ? (
                <p className="mt-2 text-xs text-muted">{service.availability_note}</p>
              ) : null}
            </Section>
          ) : service.availability_note ? (
            <Section title="Horarios">
              <p className="text-sm text-soft">{service.availability_note}</p>
            </Section>
          ) : null}

          <Section title="Características">
            <div className="flex flex-wrap gap-1.5">
              {features.map((feature) => (
                <span key={feature} className={mutedChip}>
                  {feature}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Calificación">
            <Reviews
              average={service.rating_avg}
              count={service.rating_count}
              ownerName={service.owner_name}
              slug={service.slug}
            />
          </Section>

          <Section title="Quién lo ofrece">
            <p className="text-sm text-ink/85">
              {service.owner_name}
              <span className="text-muted"> · @{service.owner_handle}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              JobIt no guarda datos de contacto de quien publica: lo que haya para escribirle está
              en la ficha.
            </p>
          </Section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-sky/40 bg-surface px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-4">
          <ReportMenu service={service} />
          <p className="text-xs text-muted">
            Publicado el {formatServiceDay(service.published_at || service.created_at)}
          </p>
        </div>
      </m.div>
    </div>
  );
}
