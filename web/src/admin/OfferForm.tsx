import { Plus } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, type Company, type OfferInput } from "./api.ts";

const LEVELS = [
  { value: "entry", label: "Junior" },
  { value: "mid", label: "Semi senior" },
  { value: "senior", label: "Senior" },
];

const REMOTES = [
  { value: "", label: "Presencial" },
  { value: "hybrid", label: "Híbrido" },
  { value: "remote", label: "Remoto" },
];

const JOB_TYPES = [
  { value: "full_time", label: "Jornada completa" },
  { value: "part_time", label: "Medio horario" },
  { value: "internship", label: "Pasantía" },
];

const EMPTY = {
  company_id: "",
  title: "",
  category: "otros",
  department: "",
  city: "",
  level: "",
  remote: "",
  job_type: "full_time",
  salary_min: "",
  salary_max: "",
  closes_at: "",
  apply_url: "",
  description: "",
  no_experience: false,
};

/** El formulario junta texto; la API pide números y nulos. */
const amount = (value: string): number | null => {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

interface Props {
  companies: Company[];
  onCreate: (input: OfferInput) => Promise<void>;
}

export function OfferForm({ companies, onCreate }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const text = (key: keyof typeof EMPTY) => ({
    value: String(form[key]),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, event.target.value as never),
  });

  const choice = (key: keyof typeof EMPTY) => ({
    value: String(form[key]),
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
      set(key, event.target.value as never),
  });

  const ready = form.company_id !== "" && form.title.trim() !== "";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || !ready) return;

    setSending(true);
    setError("");
    onCreate({
      company_id: form.company_id,
      title: form.title.trim(),
      category: form.category,
      department: form.department.trim(),
      city: form.city.trim(),
      level: form.level,
      remote: form.remote,
      job_type: form.job_type,
      salary_min: amount(form.salary_min),
      salary_max: amount(form.salary_max),
      no_experience: form.no_experience,
      closes_at: form.closes_at,
      apply_url: form.apply_url.trim(),
      description: form.description.trim(),
    })
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
        className="inline-flex items-center gap-1.5 rounded-xl border border-sky/70 bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-brand hover:bg-mist disabled:opacity-50"
        disabled={companies.length === 0}
        title={companies.length === 0 ? "Primero aprobá una empresa" : undefined}
        type="button"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden className="size-4" />
        Publicar oferta
      </button>
    );
  }

  const field =
    "w-full rounded-lg border border-sky/70 bg-mist px-2.5 py-2 text-sm text-ink outline-none focus:border-brand";

  return (
    <form
      className="rounded-xl border border-sky/60 bg-surface p-4 shadow-[var(--shadow-hairline)]"
      onSubmit={submit}
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <select className={field} required {...choice("company_id")}>
          <option value="">Empresa…</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <input autoFocus className={field} placeholder="Puesto" required {...text("title")} />

        <select className={field} {...choice("category")}>
          {CATEGORIES.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
        <select className={field} {...choice("job_type")}>
          {JOB_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input className={field} placeholder="Departamento" {...text("department")} />
        <input className={field} placeholder="Ciudad o barrio" {...text("city")} />

        <select className={field} {...choice("level")}>
          <option value="">Sin nivel definido</option>
          {LEVELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className={field} {...choice("remote")}>
          {REMOTES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          className={field}
          inputMode="numeric"
          placeholder="Sueldo desde"
          {...text("salary_min")}
        />
        <input
          className={field}
          inputMode="numeric"
          placeholder="Sueldo hasta"
          {...text("salary_max")}
        />

        <label className="flex items-center gap-2 text-xs text-soft">
          <input
            checked={form.no_experience}
            className="size-4 accent-[var(--color-brand)]"
            type="checkbox"
            onChange={(event) => set("no_experience", event.target.checked)}
          />
          No pide experiencia
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          Cierra
          <input className={field} type="date" {...text("closes_at")} />
        </label>

        <input
          className={`${field} sm:col-span-2`}
          placeholder="https://… enlace para postularse"
          {...text("apply_url")}
        />
        <textarea
          className={`${field} sm:col-span-2 resize-y`}
          placeholder="Descripción del puesto"
          rows={4}
          {...text("description")}
        />
      </div>

      {error ? <p className="mt-2.5 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded-lg bg-panel px-3 py-1.5 text-xs font-medium text-onpanel disabled:opacity-60"
          disabled={sending || !ready}
          type="submit"
        >
          Crear
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist"
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
        >
          Cancelar
        </button>
        <span className="ml-auto text-[11px] text-faint">Nace en borrador</span>
      </div>
    </form>
  );
}
