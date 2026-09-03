import { LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  COMPANY_STATUSES,
  type Company,
  type CompanyInput,
  type CompanyStatus,
  type Counts,
  STATUS_LABEL,
  Unauthorized,
  createCompany,
  deleteCompany,
  listCompanies,
  logout,
  updateCompany,
} from "./api.ts";
import { CompanyForm } from "./CompanyForm.tsx";
import { CompanyRow } from "./CompanyRow.tsx";

const NO_COUNTS: Counts = { pending: 0, approved: 0, suspended: 0 };

export function Admin({ onLeft }: { onLeft: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [counts, setCounts] = useState<Counts>(NO_COUNTS);
  const [status, setStatus] = useState<CompanyStatus | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  /** Una sesión vencida saca de la pantalla, no muestra un error rojo. */
  const handle = useCallback(
    (cause: unknown) => {
      if (cause instanceof Unauthorized) return onLeft();
      setError(cause instanceof Error ? cause.message : "algo falló");
    },
    [onLeft],
  );

  const refresh = useCallback(() => {
    setError("");
    return listCompanies(status, q)
      .then((data) => {
        setCompanies(data.companies);
        setCounts(data.counts);
      })
      .catch(handle)
      .finally(() => setLoading(false));
  }, [status, q, handle]);

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
      .catch(handle)
      .finally(() => setBusyId(null));
  };

  const create = (input: CompanyInput) => createCompany(input).then(refresh);

  const total = counts.pending + counts.approved + counts.suspended;

  return (
    <div className="min-h-svh">
      <header className="border-b border-sky/60 bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3.5">
          <h1 className="text-[15px] font-semibold tracking-tight text-ink">JobIt · Panel</h1>
          <span className="text-xs text-ink/50">
            {total} {total === 1 ? "empresa" : "empresas"}
          </span>
          <button
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink/60 hover:bg-mist hover:text-ink"
            type="button"
            onClick={() => void logout().catch(() => {}).finally(onLeft)}
          >
            <LogOut aria-hidden className="size-3.5" />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
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

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

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
      </main>
    </div>
  );
}
