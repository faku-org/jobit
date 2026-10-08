import { Archive, Eye, Loader2, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  CATEGORIES,
  type Company,
  type Offer,
  OFFER_STATUSES,
  OFFER_STATUS_LABEL,
  type OfferInput,
  type OfferStatus,
  createOffer,
  deleteOffer,
  listOffers,
  updateOffer,
} from "./api.ts";
import { OfferForm } from "./OfferForm.tsx";

const NO_COUNTS: Record<OfferStatus, number> = { draft: 0, published: 0, archived: 0 };

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

function Row({
  offer,
  busy,
  canPublish,
  onSetStatus,
  onRemove,
}: {
  offer: Offer;
  busy: boolean;
  canPublish: boolean;
  onSetStatus: (status: OfferStatus) => void;
  onRemove: () => void;
}) {
  /** Un borrado no se deshace, así que el botón pide una segunda vez. */
  const [confirming, setConfirming] = useState(false);

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
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin text-faint" /> : null}
      </div>

      {meta.length > 0 ? <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p> : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {offer.status !== "published" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist disabled:opacity-50"
            disabled={busy || !canPublish}
            title={canPublish ? undefined : "Tu empresa todavía no está aprobada"}
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

export function Offers({
  company,
  onFail,
}: {
  company: Company;
  onFail: (cause: unknown) => void;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [counts, setCounts] = useState(NO_COUNTS);
  const [status, setStatus] = useState<OfferStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listOffers()
        .then((data) => {
          setOffers(data.offers);
          setCounts(data.counts);
        })
        .catch(onFail)
        .finally(() => setLoading(false)),
    [onFail],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    run()
      .then(refresh)
      .catch(onFail)
      .finally(() => setBusyId(null));
  };

  const create = (input: OfferInput) => createOffer(input).then(() => refresh());

  const canPublish = company.status === "approved";
  const visible = status === "" ? offers : offers.filter((offer) => offer.status === status);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${status === "" ? "bg-panel text-onpanel" : "border border-sky/70 text-ink hover:bg-mist"}`}
          type="button"
          onClick={() => setStatus("")}
        >
          Todas
        </button>
        {OFFER_STATUSES.map((value) => (
          <button
            key={value}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${status === value ? "bg-panel text-onpanel" : "border border-sky/70 text-ink hover:bg-mist"}`}
            type="button"
            onClick={() => setStatus(value)}
          >
            {OFFER_STATUS_LABEL[value]}
            <span className="ml-1.5 tabular-nums opacity-60">{counts[value]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <OfferForm onCreate={create} />
      </div>

      {loading ? (
        <p className="mt-6 text-xs text-muted">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-sky/70 px-4 py-8 text-center text-xs text-muted">
          {status ? "Nada en ese estado." : "Todavía no publicaste nada."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((offer) => (
            <Row
              key={offer.id}
              busy={busyId === offer.id}
              canPublish={canPublish}
              offer={offer}
              onRemove={() => act(offer.id, () => deleteOffer(offer.id))}
              onSetStatus={(next) => act(offer.id, () => updateOffer(offer.id, { status: next }))}
            />
          ))}
        </ul>
      )}
    </>
  );
}
