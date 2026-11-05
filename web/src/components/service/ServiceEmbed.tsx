import { ArrowUpRight, Laptop, MapPin, UserRound, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "../../hooks/useTheme.ts";
import { isAbortError } from "../../lib/api.ts";
import {
  type Service,
  basePrice,
  fetchService,
  formatPrice,
  serviceCategoryLabel,
  serviceLocation,
  serviceModeLabel,
} from "../../lib/services.ts";
import { serviceLink } from "../../lib/share.ts";
import { chipClass, mutedChip } from "../../lib/styles.ts";
import type { Theme } from "../../lib/types.ts";
import { Rating } from "./Rating.tsx";

interface ServiceEmbedProps {
  slug: string;
  theme: Theme;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[560px] rounded-2xl border border-sky/50 bg-surface p-4 text-ink">
      {children}
    </div>
  );
}

function Card({ service }: { service: Service }) {
  const price = basePrice(service);
  const link = serviceLink(service.slug);

  return (
    <Frame>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-[15px] leading-snug font-semibold tracking-tight">
          <a
            className="transition-colors hover:text-brand"
            href={link}
            rel="noreferrer noopener"
            target="_blank"
          >
            {service.title}
          </a>
        </h1>
        <Rating average={service.rating_avg} count={service.rating_count} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-soft">
        <span className="inline-flex items-center gap-1.5">
          <UserRound aria-hidden className="size-3.5 shrink-0 text-brand" />
          {service.owner_name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 shrink-0 text-brand" />
          {serviceLocation(service)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={mutedChip}>{serviceCategoryLabel(service)}</span>
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
      </div>

      <div className="mt-4 flex items-center justify-end">
        <a
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel transition-colors hover:bg-brand"
          href={link}
          rel="noreferrer noopener"
          target="_blank"
        >
          Ver el servicio
          <ArrowUpRight aria-hidden className="size-4" />
        </a>
      </div>
    </Frame>
  );
}

/**
 * Un servicio en la página de otro, que es el iframe del menú de compartir.
 * Solo enlaza hacia afuera: no toca nada de lo guardado en el navegador.
 */
export function ServiceEmbed({ slug, theme }: ServiceEmbedProps) {
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState(false);

  useTheme(theme);

  useEffect(() => {
    const controller = new AbortController();
    fetchService(slug, controller.signal)
      .then(setService)
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(true);
      });
    return () => controller.abort();
  }, [slug]);

  if (error) {
    return (
      <Frame>
        <p className="text-sm text-soft">Este servicio ya no está disponible.</p>
        <a
          className="mt-1 inline-block text-sm font-medium text-brand"
          href={serviceLink(slug)}
          rel="noreferrer noopener"
          target="_blank"
        >
          Buscar en JobIt
        </a>
      </Frame>
    );
  }

  if (!service) {
    return (
      <Frame>
        <div className="animate-pulse">
          <div className="h-4 w-3/5 rounded-full bg-sky/60" />
          <div className="mt-3 h-3 w-2/5 rounded-full bg-mist" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-20 rounded-full bg-mist" />
            <div className="h-6 w-16 rounded-full bg-mist" />
          </div>
        </div>
      </Frame>
    );
  }

  return <Card service={service} />;
}
