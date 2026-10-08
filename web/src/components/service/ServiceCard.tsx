import { Clock3, Laptop, MapPin, UserRound, Wallet } from "lucide-react";
import {
  type Service,
  RESPONSE_TIME_LABEL,
  basePrice,
  formatPrice,
  serviceCategoryLabel,
  serviceLocation,
  serviceModeLabel,
} from "../../lib/services.ts";
import { serviceShare } from "../../lib/share.ts";
import { chipClass, mutedChip } from "../../lib/styles.ts";
import { ShareMenu } from "../ui/ShareMenu.tsx";
import { Rating } from "./Rating.tsx";

interface ServiceCardProps {
  service: Service;
  onOpen: (service: Service) => void;
}

/** Lo justo para decidir si vale la pena abrir la ficha: qué hace, dónde, a
 * cuánto y cómo le fue con quienes lo contrataron. */
export function ServiceCard({ service, onOpen }: ServiceCardProps) {
  const price = basePrice(service);
  const skills = service.skills.slice(0, 3);
  const response = RESPONSE_TIME_LABEL[service.response_time];

  return (
    <article className="rounded-2xl [contain-intrinsic-size:auto_260px] [content-visibility:auto]">
      <div className="relative z-[1] rounded-2xl border border-sky/50 bg-surface p-5 transition-[border-color,box-shadow] hover:border-brand hover:shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] leading-snug font-medium tracking-tight text-ink">
              <button
                className="text-left transition-colors hover:text-brand"
                type="button"
                onClick={() => onOpen(service)}
              >
                {service.title}
              </button>
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

          <div className="flex shrink-0 gap-1.5">
            <ShareMenu target={serviceShare(service)} />
          </div>
        </div>

        {service.summary ? (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-soft">{service.summary}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className={mutedChip}>{serviceCategoryLabel(service)}</span>
          <span className={`${chipClass} bg-sky/40 text-ink`}>
            <Laptop aria-hidden className="size-3.5" />
            {serviceModeLabel(service)}
          </span>
          {price ? (
            <span className={`${chipClass} bg-wash text-ink`}>
              <Wallet aria-hidden className="size-3.5" />
              {/* Un precio que no es cerrado es una referencia, y "desde" lo
                  dice sin contradecir al número que está al lado. */}
              {service.fixed_price ? formatPrice(price) : `desde ${formatPrice(price)}`}
            </span>
          ) : (
            <span className={mutedChip}>Precio a convenir</span>
          )}
          {response ? (
            <span className={mutedChip}>
              <Clock3 aria-hidden className="size-3.5" />
              {response}
            </span>
          ) : null}
          {skills.map((skill) => (
            <span key={skill} className={`${chipClass} bg-mist text-soft`}>
              {skill}
            </span>
          ))}
          {service.skills.length > skills.length ? (
            <span className="text-xs text-muted">+{service.skills.length - skills.length}</span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Rating average={service.rating_avg} count={service.rating_count} />
          <button
            className="-mx-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap text-muted transition-colors hover:text-ink sm:mx-0 sm:min-h-0 sm:px-1"
            type="button"
            onClick={() => onOpen(service)}
          >
            Ver el servicio
          </button>
        </div>
      </div>
    </article>
  );
}
