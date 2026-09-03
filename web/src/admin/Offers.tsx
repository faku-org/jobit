import { useCallback, useEffect, useState } from "react";
import {
  type Company,
  OFFER_STATUSES,
  OFFER_STATUS_LABEL,
  type Offer,
  type OfferInput,
  type OfferStatus,
  createOffer,
  deleteOffer,
  listCompanies,
  listOffers,
  updateOffer,
} from "./api.ts";
import { OfferForm } from "./OfferForm.tsx";
import { OfferRow } from "./OfferRow.tsx";

const NO_COUNTS: Record<OfferStatus, number> = { draft: 0, published: 0, archived: 0 };

interface Props {
  onFail: (cause: unknown) => void;
}

export function Offers({ onFail }: Props) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [counts, setCounts] = useState(NO_COUNTS);
  /** Solo las aprobadas: colgarle una oferta a una empresa suspendida es
   * publicar algo que el tablero no va a mostrar. */
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<OfferStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listOffers(status)
        .then((data) => {
          setOffers(data.offers);
          setCounts(data.counts);
        })
        .catch(onFail)
        .finally(() => setLoading(false)),
    [status, onFail],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    listCompanies("approved", "")
      .then((data) => setCompanies(data.companies))
      .catch(onFail);
  }, [onFail]);

  const act = (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    run()
      .then(refresh)
      .catch(onFail)
      .finally(() => setBusyId(null));
  };

  const create = (input: OfferInput) => createOffer(input).then(refresh);

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
        <OfferForm companies={companies} onCreate={create} />
      </div>

      {loading ? (
        <p className="mt-6 text-xs text-ink/50">Cargando…</p>
      ) : offers.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-sky/70 px-4 py-8 text-center text-xs text-ink/50">
          {status
            ? "Nada en ese estado."
            : companies.length === 0
              ? "Aprobá una empresa y vas a poder publicarle ofertas."
              : "Todavía no hay ofertas propias."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              busy={busyId === offer.id}
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
