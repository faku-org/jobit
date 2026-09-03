import { Plus } from "lucide-react";
import { useState } from "react";
import type { CompanyInput } from "./api.ts";

const EMPTY = { name: "", email: "", website: "" };

export function CompanyForm({ onCreate }: { onCreate: (input: CompanyInput) => Promise<void> }) {
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const field = (key: keyof typeof EMPTY) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || !form.name.trim()) return;

    setSending(true);
    setError("");
    onCreate({ name: form.name.trim(), email: form.email.trim(), website: form.website.trim() })
      .then(() => {
        setForm(EMPTY);
        setOpen(false);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "no se pudo"))
      .finally(() => setSending(false));
  };

  if (!open) {
    return (
      <button
        className="inline-flex items-center gap-1.5 rounded-xl border border-sky/70 bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-brand hover:bg-mist"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden className="size-4" />
        Agregar empresa
      </button>
    );
  }

  const input =
    "w-full rounded-lg border border-sky/70 bg-mist px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

  return (
    <form
      className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]"
      onSubmit={submit}
    >
      <div className="grid gap-2.5 sm:grid-cols-3">
        <input autoFocus className={input} placeholder="Nombre" required {...field("name")} />
        <input className={input} placeholder="Correo" type="email" {...field("email")} />
        <input className={input} placeholder="https://sitio.com" {...field("website")} />
      </div>

      {error ? <p className="mt-2.5 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded-lg bg-panel px-3 py-1.5 text-xs font-medium text-onpanel disabled:opacity-60"
          disabled={sending || !form.name.trim()}
          type="submit"
        >
          Crear
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-mist"
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
        >
          Cancelar
        </button>
        <span className="ml-auto text-[11px] text-ink/40">Entra como pendiente</span>
      </div>
    </form>
  );
}
