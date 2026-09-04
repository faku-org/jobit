import { Check, ExternalLink, Loader2, Pause, Trash2 } from "lucide-react";
import { useState } from "react";
import { type Company, type CompanyStatus, STATUS_LABEL } from "./api.ts";

const BADGE: Record<CompanyStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  suspended: "bg-wash text-muted",
};

interface Props {
  company: Company;
  busy: boolean;
  onSetStatus: (status: CompanyStatus) => void;
  onSetNotes: (notes: string) => void;
  onRemove: () => void;
}

export function CompanyRow({ company, busy, onSetStatus, onSetNotes, onRemove }: Props) {
  const [notes, setNotes] = useState(company.notes);
  /** Un borrado no se deshace, así que el botón pide una segunda vez. */
  const [confirming, setConfirming] = useState(false);

  const notesChanged = notes.trim() !== company.notes;

  return (
    <li className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{company.name}</h3>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${BADGE[company.status]}`}
        >
          {STATUS_LABEL[company.status]}
        </span>
        <code className="text-[11px] text-faint">/{company.slug}</code>
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin text-faint" /> : null}
      </div>

      {company.email || company.website ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          {company.email ? <span>{company.email}</span> : null}
          {company.website ? (
            <a
              className="inline-flex items-center gap-1 text-brand hover:underline"
              href={company.website}
              rel="noreferrer noopener"
              target="_blank"
            >
              Sitio
              <ExternalLink aria-hidden className="size-3" />
            </a>
          ) : null}
        </p>
      ) : null}

      <textarea
        className="mt-3 w-full resize-y rounded-lg border border-sky/60 bg-mist px-2.5 py-2 text-xs text-ink outline-none focus:border-brand"
        placeholder="Notas internas"
        rows={2}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {notesChanged ? (
          <button
            className="rounded-lg bg-panel px-2.5 py-1.5 text-xs font-medium text-onpanel"
            disabled={busy}
            type="button"
            onClick={() => onSetNotes(notes.trim())}
          >
            Guardar nota
          </button>
        ) : null}

        {company.status !== "approved" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
            disabled={busy}
            type="button"
            onClick={() => onSetStatus("approved")}
          >
            <Check aria-hidden className="size-3.5" />
            Aprobar
          </button>
        ) : null}

        {company.status !== "suspended" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
            disabled={busy}
            type="button"
            onClick={() => onSetStatus("suspended")}
          >
            <Pause aria-hidden className="size-3.5" />
            Suspender
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
