import { LogOut } from "lucide-react";
import { useCallback, useState } from "react";
import { type Company, COMPANY_STATUS_LABEL, Unauthorized, logout } from "./api.ts";
import { Account } from "./Account.tsx";
import { Metrics } from "./Metrics.tsx";
import { Offers } from "./Offers.tsx";

const TABS = [
  { id: "metrics", label: "Resumen" },
  { id: "offers", label: "Publicaciones" },
  { id: "account", label: "Empresa" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const STATUS_BADGE: Record<Company["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  suspended: "bg-red-100 text-red-700",
};

export function Dashboard({
  company: initialCompany,
  onLeft,
}: {
  company: Company;
  onLeft: () => void;
}) {
  const [company, setCompany] = useState(initialCompany);
  const [tab, setTab] = useState<Tab>("metrics");
  const [error, setError] = useState("");

  /** Una sesión vencida saca de la pantalla, no muestra un error rojo. */
  const handle = useCallback(
    (cause: unknown) => {
      if (cause instanceof Unauthorized) return onLeft();
      setError(cause instanceof Error ? cause.message : "algo falló");
    },
    [onLeft],
  );

  return (
    <div className="min-h-svh">
      <header className="border-b border-sky/60 bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3.5">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">
            {company.name}
          </h1>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[company.status]}`}
          >
            {COMPANY_STATUS_LABEL[company.status]}
          </span>
          <button
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-mist hover:text-ink"
            type="button"
            onClick={() =>
              void logout()
                .catch(() => {})
                .finally(onLeft)
            }
          >
            <LogOut aria-hidden className="size-3.5" />
            Salir
          </button>
        </div>

        <nav className="mx-auto flex max-w-3xl gap-1 px-5">
          {TABS.map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? "page" : undefined}
              className={`-mb-px border-b-2 px-2.5 py-2 text-xs font-medium ${tab === item.id ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
              type="button"
              onClick={() => {
                setTab(item.id);
                setError("");
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {company.status === "pending" ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800">
            Tu cuenta está pendiente de aprobación. Podés cargar tus ofertas como borrador y van a
            salir al tablero en cuanto la aprobemos.
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        {tab === "metrics" ? (
          <Metrics onFail={handle} />
        ) : tab === "offers" ? (
          <Offers company={company} onFail={handle} />
        ) : (
          <Account company={company} onFail={handle} onUpdated={setCompany} />
        )}
      </main>
    </div>
  );
}
