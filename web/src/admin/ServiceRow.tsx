import { Ban, Check, Flag, Loader2, X } from "lucide-react";
import {
  CATEGORIES,
  type Decision,
  type QueueItem,
  SERVICE_STATUS_LABEL,
  type ServicePrice,
  type ReviewStatus,
  type ServiceStatus,
} from "./api.ts";

const BADGE: Record<ServiceStatus, string> = {
  draft: "bg-wash text-muted",
  pending: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
  suspended: "bg-amber-100 text-amber-800",
};

/** El puntaje es para ordenar, así que el color dice lo mismo que el número. */
const scoreTone = (score: number): string =>
  score >= 60
    ? "bg-red-100 text-red-800"
    : score >= 30
      ? "bg-amber-100 text-amber-800"
      : "bg-wash text-muted";

const label = (slug: string): string =>
  CATEGORIES.find((category) => category.slug === slug)?.label ?? slug;

const price = (value: ServicePrice): string =>
  [
    `${value.currency === "USD" ? "US$" : "$"} ${value.amount.toLocaleString("es-UY")}`,
    value.unit ? `por ${value.unit}` : "",
    value.label,
  ]
    .filter(Boolean)
    .join(" · ");

interface Props {
  item: QueueItem;
  busy: boolean;
  onDecide: (decision: Decision) => void;
  onDecideReview: (reviewId: string, status: ReviewStatus) => void;
}

export function ServiceRow({ item, busy, onDecide, onDecideReview }: Props) {
  const { service, review, reports, reported_reviews: flagged } = item;

  const meta = [
    label(service.category),
    [service.city, service.department].filter(Boolean).join(", "),
    service.skills.slice(0, 4).join(", "),
  ].filter(Boolean);

  /** El filtro pudo haberlo devuelto a borrador solo: eso se dice, porque la
   * decisión sigue siendo revisable. */
  const autoRejected = review?.decision === "rejected" && !review.decided_by;

  return (
    <li className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{service.title}</h3>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${BADGE[service.status]}`}
        >
          {SERVICE_STATUS_LABEL[service.status]}
        </span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${scoreTone(review?.score ?? 0)}`}
        >
          {review?.score ?? 0}
        </span>
        {reports > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
            <Flag aria-hidden className="size-3" />
            {reports}
          </span>
        ) : null}
        <span className="text-xs text-muted">@{service.owner_handle}</span>
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin text-faint" /> : null}
      </div>

      {meta.length > 0 ? <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p> : null}

      {service.summary ? <p className="mt-2 text-xs text-ink">{service.summary}</p> : null}

      {service.description ? (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs text-muted">
          {service.description}
        </p>
      ) : null}

      {service.prices.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {service.prices.map((value, index) => (
            <li
              key={`${value.kind}-${index}`}
              className="rounded-md bg-wash px-1.5 py-0.5 text-[11px] text-muted"
            >
              {value.kind === "extra" ? "Extra: " : ""}
              {price(value)}
            </li>
          ))}
        </ul>
      ) : null}

      {review && review.reasons.length > 0 ? (
        <ul className="mt-3 space-y-1 border-l-2 border-sky/60 pl-2.5">
          {review.reasons.map((reason) => (
            <li key={reason.code} className="text-[11px] text-muted">
              <span className="font-medium text-ink">{reason.code}</span> · {reason.detail}
              <span className="ml-1 tabular-nums opacity-60">+{reason.weight}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {autoRejected ? (
        <p className="mt-2 text-[11px] text-amber-700">
          El filtro lo devolvió a borrador solo. Se puede aprobar igual.
        </p>
      ) : null}

      {flagged.length > 0 ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-2.5">
          <p className="text-[11px] font-medium text-red-800">
            {flagged.length === 1
              ? "Una calificación denunciada"
              : `${flagged.length} calificaciones denunciadas`}
          </p>

          <ul className="mt-2 space-y-2">
            {flagged.map((flaggedReview) => (
              <li key={flaggedReview.id} className="rounded-md bg-surface px-2.5 py-2">
                <p className="text-[11px] text-muted">
                  {flaggedReview.rating}/5 · {flaggedReview.author_name || "cuenta borrada"} ·{" "}
                  {flaggedReview.created_at}
                  {flaggedReview.edited ? " · corregida" : ""}
                </p>
                {flaggedReview.comment ? (
                  <p className="mt-1 whitespace-pre-line text-xs text-ink">
                    {flaggedReview.comment}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted italic">Sin texto: es solo la nota.</p>
                )}
                {flaggedReview.reply ? (
                  <p className="mt-1 border-l-2 border-sky/60 pl-2 text-[11px] text-muted">
                    Respondió: {flaggedReview.reply}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2 py-1 text-[11px] font-medium text-ink hover:bg-mist disabled:opacity-50"
                    disabled={busy}
                    type="button"
                    onClick={() => onDecideReview(flaggedReview.id, "hidden")}
                  >
                    <Ban aria-hidden className="size-3" />
                    Bajar
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2 py-1 text-[11px] font-medium text-ink hover:bg-mist disabled:opacity-50"
                    disabled={busy}
                    type="button"
                    onClick={() => onDecideReview(flaggedReview.id, "visible")}
                  >
                    <Check aria-hidden className="size-3" />
                    Dejarla
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-[11px] text-muted">
            Bajarla la saca del promedio. Dejarla solo cierra la denuncia.
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-panel px-2.5 py-1.5 text-xs font-medium text-onpanel disabled:opacity-50"
          disabled={busy}
          type="button"
          onClick={() => onDecide("approved")}
        >
          <Check aria-hidden className="size-3.5" />
          Aprobar
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist disabled:opacity-50"
          disabled={busy}
          type="button"
          onClick={() => onDecide("rejected")}
        >
          <X aria-hidden className="size-3.5" />
          Rechazar
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist disabled:opacity-50"
          disabled={busy}
          type="button"
          onClick={() => onDecide("suspended")}
        >
          <Ban aria-hidden className="size-3.5" />
          Suspender
        </button>
      </div>
    </li>
  );
}
