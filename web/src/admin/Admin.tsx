import { LogOut } from "lucide-react";
import { useCallback, useState } from "react";
import { Unauthorized, logout } from "./api.ts";
import { Companies } from "./Companies.tsx";
import { Offers } from "./Offers.tsx";
import { Usage } from "./Usage.tsx";

const TABS = [
  { id: "companies", label: "Empresas" },
  { id: "offers", label: "Ofertas" },
  { id: "usage", label: "Uso" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function Admin({ onLeft }: { onLeft: () => void }) {
  const [tab, setTab] = useState<Tab>("companies");
  const [total, setTotal] = useState(0);
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
          <h1 className="text-[15px] font-semibold tracking-tight text-ink">JobIt · Panel</h1>
          <span className="text-xs text-muted">
            {total} {total === 1 ? "empresa" : "empresas"}
          </span>
          <button
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-mist hover:text-ink"
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
        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        {/* Las dos pestañas se montan y desmontan a propósito: al volver
            releen, que es lo que hace falta cuando aprobar una empresa cambia
            lo que la otra puede mostrar. */}
        {tab === "companies" ? (
          <Companies onCount={setTotal} onFail={handle} />
        ) : tab === "offers" ? (
          <Offers onFail={handle} />
        ) : (
          <Usage onFail={handle} />
        )}
      </main>
    </div>
  );
}
