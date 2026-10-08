import { Flag, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  MAX_RATING,
  MIN_RATING,
  RATING_LABEL,
  type Review,
  type ReviewsPage,
  createReview,
  deleteReview,
  fetchReviews,
  replyReview,
  reportReview,
  updateReview,
} from "../../lib/reviews.ts";
import {
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  type ReportReason,
  formatServiceDay,
} from "../../lib/services.ts";
import { fieldClass, menuItemClass } from "../../lib/styles.ts";
import { AccountPanel } from "./AccountPanel.tsx";
import { Rating } from "./Rating.tsx";

interface ReviewsProps {
  slug: string;
  /** Lo que ya traía la ficha, para no mostrar un cero mientras carga. */
  average: number;
  count: number;
  /** Quién publica, para firmar su respuesta con su nombre. */
  ownerName: string;
}

/** Lo que hay abierto arriba de la lista: nada, la cuenta o el formulario. */
type Panel = "none" | "account" | "form";

const STARS = [1, 2, 3, 4, 5];

/**
 * Elegir la nota con estrellas que se pueden pulsar, y el texto al lado: un
 * 3 pelado no dice lo mismo para todo el mundo.
 */
function StarPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-0.5" role="radiogroup">
        {STARS.map((star) => (
          <button
            key={star}
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"}: ${RATING_LABEL[star]}`}
            className="rounded-lg p-1 transition-transform hover:scale-110"
            role="radio"
            type="button"
            onClick={() => onChange(star)}
          >
            <Star
              aria-hidden
              className={`size-6 ${star <= value ? "fill-current text-brand" : "text-sky"}`}
            />
          </button>
        ))}
      </div>
      <span className="text-xs text-soft">
        {value > 0 ? RATING_LABEL[value] : "Elegí una nota"}
      </span>
    </div>
  );
}

/** La nota de una opinión sola: estrellas y nada más. El promedio y el conteo
 * son de arriba, y repetir "(1)" en cada fila no dice nada. */
function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} de ${MAX_RATING}`} className="inline-flex">
      {STARS.map((star) => (
        <Star
          key={star}
          aria-hidden
          className={`size-3.5 ${star <= rating ? "fill-current text-brand" : "text-sky"}`}
        />
      ))}
    </span>
  );
}

/** La misma lista corta que para un servicio, sin caja de texto. */
function ReportMenu({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return <span className="text-xs text-muted">Gracias: alguien lo va a mirar.</span>;

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Denunciar esta calificación"
        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-muted transition-colors hover:text-ink"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Flag aria-hidden className="size-3" />
        Denunciar
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-40 mt-1 w-56 rounded-xl border border-sky/60 bg-surface p-1 shadow-[var(--shadow-panel)]">
          {REPORT_REASONS.map((reason: ReportReason) => (
            <button
              key={reason}
              className={menuItemClass}
              type="button"
              onClick={() => {
                setOpen(false);
                setSent(true);
                void reportReview(reviewId, reason).catch(() => {});
              }}
            >
              {REPORT_REASON_LABEL[reason]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** El formulario de la nota, que sirve igual para escribirla y para la única
 * corrección que se permite. */
function ReviewForm({
  initial,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  initial: Review | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (rating: number, comment: string) => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");

  return (
    <form
      className="space-y-3 rounded-xl border border-sky/60 bg-wash p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(rating, comment);
      }}
    >
      <StarPicker value={rating} onChange={setRating} />

      <label className="block">
        <span className="text-xs font-medium text-soft">Contá cómo fue (opcional)</span>
        <textarea
          aria-label="Contá cómo fue"
          className={`${fieldClass} mt-1 min-h-20 px-3.5 py-2.5`}
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>

      {error ? <p className="text-xs text-brand">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-panel px-3.5 py-2 text-xs font-medium text-onpanel transition-colors hover:bg-brand disabled:opacity-60"
          disabled={busy || rating < MIN_RATING || rating > MAX_RATING}
          type="submit"
        >
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
          {initial ? "Guardar la corrección" : "Publicar calificación"}
        </button>
        <button
          className="text-xs font-medium text-muted transition-colors hover:text-ink"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
        {initial ? (
          <span className="text-xs text-muted">Se puede corregir una sola vez.</span>
        ) : null}
      </div>
    </form>
  );
}

/** Una calificación con lo que se pueda hacer con ella según quién mire. */
function ReviewRow({
  review,
  mine,
  isOwner,
  ownerName,
  onEdit,
  onDelete,
  onReply,
}: {
  review: Review;
  mine: boolean;
  isOwner: boolean;
  ownerName: string;
  onEdit: () => void;
  onDelete: () => void;
  onReply: (text: string) => void;
}) {
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState("");

  return (
    <li className="rounded-xl border border-sky/50 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <Stars rating={review.rating} />
          <p className="mt-1 text-xs text-muted">
            {review.author_name || "Cuenta borrada"}
            {review.author_handle ? ` · @${review.author_handle}` : ""} ·{" "}
            {formatServiceDay(review.created_at)}
            {review.edited ? " · corregida" : ""}
            {mine ? " · tuya" : ""}
          </p>
        </div>
        {mine ? null : <ReportMenu reviewId={review.id} />}
      </div>

      {review.comment ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink/85">
          {review.comment}
        </p>
      ) : null}

      {review.reply ? (
        <div className="mt-3 rounded-lg border-l-2 border-brand bg-mist px-3 py-2">
          <p className="text-xs font-medium text-soft">Respuesta de {ownerName}</p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink/85">
            {review.reply}
          </p>
        </div>
      ) : null}

      {mine && !review.edited ? (
        <div className="mt-2 flex gap-3">
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
            type="button"
            onClick={onEdit}
          >
            <Pencil aria-hidden className="size-3" />
            Corregir
          </button>
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
            type="button"
            onClick={onDelete}
          >
            <Trash2 aria-hidden className="size-3" />
            Borrar
          </button>
        </div>
      ) : mine ? (
        <div className="mt-2 flex gap-3">
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
            type="button"
            onClick={onDelete}
          >
            <Trash2 aria-hidden className="size-3" />
            Borrar
          </button>
        </div>
      ) : null}

      {isOwner && !review.reply ? (
        answering ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              onReply(text);
            }}
          >
            <textarea
              aria-label="Tu respuesta"
              className={`${fieldClass} min-h-16 px-3.5 py-2.5`}
              maxLength={1000}
              placeholder="Tu versión, una sola vez."
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="rounded-xl bg-panel px-3 py-1.5 text-xs font-medium text-onpanel transition-colors hover:bg-brand disabled:opacity-60"
                disabled={!text.trim()}
                type="submit"
              >
                Responder
              </button>
              <button
                className="text-xs font-medium text-muted transition-colors hover:text-ink"
                type="button"
                onClick={() => setAnswering(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            className="mt-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            type="button"
            onClick={() => setAnswering(true)}
          >
            Responder una vez
          </button>
        )
      ) : null}
    </li>
  );
}

/**
 * La calificación de un servicio dentro de la ficha: el promedio con el conteo
 * al lado, las opiniones y, si hay con qué, la forma de dejar la propia.
 *
 * Calificar pide cuenta y la cuenta aparece acá adentro, como en el alta de un
 * servicio: es un paso, no un lugar al que ir.
 */
export function Reviews({ slug, average, count, ownerName }: ReviewsProps) {
  const [page, setPage] = useState<ReviewsPage | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(
    (signal?: AbortSignal) => {
      fetchReviews(slug, signal)
        .then((fresh) => setPage(fresh))
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : "No se pudieron cargar");
        });
    },
    [slug],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Cada escritura vuelve a pedir todo: el promedio lo calcula la API y
   * adivinarlo acá sería mostrar un número que nadie escribió. */
  const run = (work: () => Promise<unknown>, done = "") => {
    setBusy(true);
    setError("");
    work()
      .then(() => {
        setPanel("none");
        setEditing(false);
        setNote(done);
        load();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudo, probá de nuevo");
      })
      .finally(() => setBusy(false));
  };

  const summary = page?.summary ?? { average, count };
  const mine = page?.mine ?? null;
  const others = (page?.reviews ?? []).filter((review) => review.id !== mine?.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Rating average={summary.average} count={summary.count} size="md" />

        {page && !mine && !page.is_owner ? (
          <button
            className="rounded-xl border border-sky/70 bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-mist"
            type="button"
            onClick={() => {
              setError("");
              setNote("");
              setPanel(page.can_review === null ? "account" : "form");
            }}
          >
            Calificar este servicio
          </button>
        ) : null}
      </div>

      {note ? <p className="text-xs text-soft">{note}</p> : null}
      {error && panel === "none" && !editing ? <p className="text-xs text-brand">{error}</p> : null}

      {panel === "account" ? (
        <AccountPanel
          reason="Calificar necesita una cuenta: es lo que evita que la misma persona vote diez veces."
          onCancel={() => setPanel("none")}
          onReady={() => {
            setPanel("form");
            load();
          }}
        />
      ) : null}

      {panel === "form" ? (
        <ReviewForm
          busy={busy}
          error={error}
          initial={null}
          onCancel={() => setPanel("none")}
          onSubmit={(rating, comment) =>
            run(() => createReview(slug, { rating, comment }), "Gracias: tu calificación ya está.")
          }
        />
      ) : null}

      {editing && mine ? (
        <ReviewForm
          busy={busy}
          error={error}
          initial={mine}
          onCancel={() => setEditing(false)}
          onSubmit={(rating, comment) =>
            run(() => updateReview(mine.id, { rating, comment }), "Quedó corregida.")
          }
        />
      ) : null}

      {mine && mine.status === "hidden" ? (
        <p className="rounded-xl border border-sky/60 bg-mist px-3.5 py-2.5 text-xs leading-relaxed text-soft">
          Tu calificación la bajó la moderación, así que no se ve en la ficha.
        </p>
      ) : null}

      {mine || others.length > 0 ? (
        <ul className="space-y-2">
          {mine && !editing ? (
            <ReviewRow
              key={mine.id}
              isOwner={false}
              mine
              ownerName={ownerName}
              review={mine}
              onDelete={() => run(() => deleteReview(mine.id), "Borraste tu calificación.")}
              onEdit={() => {
                setError("");
                setEditing(true);
              }}
              onReply={() => {}}
            />
          ) : null}

          {others.map((review) => (
            <ReviewRow
              key={review.id}
              isOwner={page?.is_owner ?? false}
              mine={false}
              ownerName={ownerName}
              review={review}
              onDelete={() => {}}
              onEdit={() => {}}
              onReply={(text) => run(() => replyReview(review.id, text), "Quedó tu respuesta.")}
            />
          ))}
        </ul>
      ) : null}

      {page?.is_owner ? (
        <p className="text-xs text-muted">
          Un servicio propio no se califica. Podés responder una vez cada opinión.
        </p>
      ) : null}
    </div>
  );
}
