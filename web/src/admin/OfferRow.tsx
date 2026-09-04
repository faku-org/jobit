import { Archive, Eye, Loader2, Send, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, type Offer, OFFER_STATUS_LABEL, type OfferStatus } from "./api.ts";

const BADGE: Record<OfferStatus, string> = {
  draft: "bg-wash text-muted",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-800",
};

const label = (slug: string): string =>
  CATEGORIES.find((category) => category.slug === slug)?.label ?? slug;

const money = (value: number | null): string =>
  value === null ? "" : `$ ${value.toLocaleString("es-UY")}`;

function salary(offer: Offer): string {
  if (offer.salary_min !== null && offer.salary_max !== null) {
    return `${money(offer.salary_min)} a ${money(offer.salary_max)}`;
  }
  if (offer.salary_min !== null) return `desde ${money(offer.salary_min)}`;
  if (offer.salary_max !== null) return `hasta ${money(offer.salary_max)}`;
  return "";
}

interface Props {
  offer: Offer;
  busy: boolean;
  onSetStatus: (status: OfferStatus) => void;
  onRemove: () => void;
}

export function OfferRow({ offer, busy, onSetStatus, onRemove }: Props) {
  /** Un borrado no se deshace, así que el botón pide una segunda vez. */
  const [confirming, setConfirming] = useState(false);

  /** Publicada de empresa no aprobada no llega al tablero, y desde acá eso se
   * ve como una oferta publicada que nadie encuentra. */
  const stuck = offer.status === "published" && offer.company_status !== "approved";

  const meta = [
    label(offer.category),
    [offer.city, offer.department].filter(Boolean).join(", "),
    salary(offer),
    offer.no_experience ? "sin experiencia" : "",
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{offer.title}</h3>
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${BADGE[offer.status]}`}>
          {OFFER_STATUS_LABEL[offer.status]}
        </span>
        <span className="text-xs text-muted">{offer.company_name}</span>
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin text-faint" /> : null}
      </div>

      {meta.length > 0 ? <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p> : null}

      {stuck ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          <TriangleAlert aria-hidden className="size-3.5" />
          La empresa no está aprobada, así que esto no sale al tablero.
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {offer.status !== "published" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
            disabled={busy}
            type="button"
            onClick={() => onSetStatus("published")}
          >
            <Send aria-hidden className="size-3.5" />
            Publicar
          </button>
        ) : null}

        {offer.status !== "draft" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
            disabled={busy}
            type="button"
            onClick={() => onSetStatus("draft")}
          >
            <Eye aria-hidden className="size-3.5" />
            Volver a borrador
          </button>
        ) : null}

        {offer.status !== "archived" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
            disabled={busy}
            type="button"
            onClick={() => onSetStatus("archived")}
          >
            <Archive aria-hidden className="size-3.5" />
            Archivar
          </button>
        ) : null}

        <button
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          disabled={busy}
          type="button"
          onBlur={() => setConfirming(false)}
          onClick={() => (confirming ? onRemove() : setConfirming(true))}
        >
          <Trash2 aria-hidden className="size-3.5" />
          {confirming ? "Confirmá" : "Borrar"}
        </button>
      </div>
    </li>
  );
}
