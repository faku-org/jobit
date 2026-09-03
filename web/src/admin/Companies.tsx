import { useCallback, useEffect, useState } from "react";
import {
  COMPANY_STATUSES,
  type Company,
  type CompanyInput,
  type CompanyStatus,
  type Counts,
  STATUS_LABEL,
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
} from "./api.ts";
import { CompanyForm } from "./CompanyForm.tsx";
import { CompanyRow } from "./CompanyRow.tsx";

const NO_COUNTS: Counts = { pending: 0, approved: 0, suspended: 0 };

interface Props {
  onFail: (cause: unknown) => void;
  onCount: (total: number) => void;
}

export function Companies({ onFail, onCount }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [counts, setCounts] = useState<Counts>(NO_COUNTS);
  const [status, setStatus] = useState<CompanyStatus | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listCompanies(status, q)
        .then((data) => {
          setCompanies(data.companies);
          setCounts(data.counts);
          onCount(data.counts.pending + data.counts.approved + data.counts.suspended);
        })
        .catch(onFail)
        .finally(() => setLoading(false)),
    [status, q, onFail, onCount],
  );

  useEffect(() => {
    const timer = setTimeout(refresh, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [refresh, q]);

  /** Cada acción sobre una fila termina releyendo el listado: los contadores y
   * el orden dependen del estado, así que cambiarlo mueve la lista entera. */
  const act = (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    run()
      .then(refresh)
      .catch(onFail)
      .finally(() => setBusyId(null));
  };

  const create = (input: CompanyInput) => createCompany(input).then(refresh);

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
        {COMPANY_STATUSES.map((value) => (
          <button
            key={value}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${status === value ? "bg-panel text-onpanel" : "border border-sky/70 text-ink hover:bg-mist"}`}
            type="button"
            onClick={() => setStatus(value)}
          >
            {STATUS_LABEL[value]}
            <span className="ml-1.5 tabular-nums opacity-60">{counts[value]}</span>
          </button>
        ))}

        <input
          className="ml-auto w-44 rounded-lg border border-sky/70 bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand"
          placeholder="Buscar"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      <div className="mt-4">
        <CompanyForm onCreate={create} />
      </div>

      {loading ? (
        <p className="mt-6 text-xs text-ink/50">Cargando…</p>
      ) : companies.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-sky/70 px-4 py-8 text-center text-xs text-ink/50">
          {q || status
            ? "Nada que coincida con eso."
            : "Todavía no hay empresas. Agregá la primera."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {companies.map((company) => (
            <CompanyRow
              key={company.id}
              busy={busyId === company.id}
              company={company}
              onRemove={() => act(company.id, () => deleteCompany(company.id))}
              onSetNotes={(notes) => act(company.id, () => updateCompany(company.id, { notes }))}
              onSetStatus={(next) =>
                act(company.id, () => updateCompany(company.id, { status: next }))
              }
            />
          ))}
        </ul>
      )}
    </>
  );
}
