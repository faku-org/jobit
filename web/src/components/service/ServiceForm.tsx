import { CATEGORIES } from "@jobit/worker/categories";
import { DEPARTMENTS } from "@jobit/worker/departments";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { type ServiceInput, createService, updateService } from "../../lib/account.ts";
import {
  type Currency,
  type Service,
  type ServiceHour,
  type ServicePrice,
  PRICE_UNIT_LABEL,
  WEEKDAY_LABEL,
} from "../../lib/services.ts";
import { fieldClass } from "../../lib/styles.ts";
import { type Option, Select } from "../ui/Select.tsx";

interface ServiceFormProps {
  /** El servicio que se está editando; sin él, es uno nuevo. */
  service?: Service;
  onSaved: (service: Service) => void;
  onCancel: () => void;
}

const CATEGORY_OPTIONS: Option[] = CATEGORIES.map((category) => ({
  value: category.slug,
  label: category.label,
}));

const DEPARTMENT_OPTIONS: Option[] = [
  { value: "", label: "Todo el país" },
  ...DEPARTMENTS.map((name) => ({ value: name, label: name })),
];

const MODE_OPTIONS: Option[] = [
  { value: "onsite", label: "Presencial" },
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
];

const STYLE_OPTIONS: Option[] = [
  { value: "individual", label: "Por cuenta propia" },
  { value: "equipo", label: "Con equipo" },
  { value: "empresa", label: "Empresa" },
];

const RESPONSE_OPTIONS: Option[] = [
  { value: "", label: "Sin decir" },
  { value: "mismo-dia", label: "El mismo día" },
  { value: "48-horas", label: "En 48 horas" },
  { value: "semana", label: "En la semana" },
];

const UNIT_OPTIONS: Option[] = [
  { value: "", label: "Sin unidad" },
  ...Object.entries(PRICE_UNIT_LABEL).map(([value, label]) => ({ value, label })),
];

const CURRENCY_OPTIONS: Option[] = [
  { value: "UYU", label: "Pesos" },
  { value: "USD", label: "Dólares" },
];

const WEEKDAY_OPTIONS: Option[] = WEEKDAY_LABEL.map((label, index) => ({
  value: String(index),
  label,
}));

const emptyPrice = (kind: ServicePrice["kind"]): ServicePrice => ({
  kind,
  label: "",
  amount: 0,
  currency: "UYU",
  unit: "",
  notes: "",
});

const emptyHour = (): ServiceHour => ({ weekday: 1, from: "09:00", to: "18:00" });

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-soft">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass = `${fieldClass} px-3.5 py-2.5`;

/** El `aria-label` va repetido a propósito: el texto de arriba alcanza para
 * quien ve, y el atributo para quien navega por la lista de campos. */
function TextField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  inputMode?: "numeric";
}) {
  return (
    <Labelled label={label}>
      {rows ? (
        <textarea
          aria-label={label}
          className={`${inputClass} min-h-32`}
          placeholder={placeholder}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          className={inputClass}
          inputMode={inputMode}
          placeholder={placeholder}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Labelled>
  );
}

/**
 * Publicar y editar. Lo que se manda a revisión no se publica solo: la
 * moderación es previa, así que el formulario dice a dónde va lo que se
 * guarda en vez de dejar creer que ya está arriba.
 */
export function ServiceForm({ service, onSaved, onCancel }: ServiceFormProps) {
  const [title, setTitle] = useState(service?.title ?? "");
  const [summary, setSummary] = useState(service?.summary ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [category, setCategory] = useState(service?.category ?? "oficios");
  const [department, setDepartment] = useState(service?.department ?? "");
  const [city, setCity] = useState(service?.city ?? "");
  const [remote, setRemote] = useState(service?.remote || "onsite");
  const [workStyle, setWorkStyle] = useState(service?.work_style || "individual");
  const [responseTime, setResponseTime] = useState(service?.response_time ?? "");
  const [experience, setExperience] = useState(
    service?.experience_years === null || service?.experience_years === undefined
      ? ""
      : String(service.experience_years),
  );
  const [fixedPrice, setFixedPrice] = useState(service?.fixed_price ?? false);
  const [availability, setAvailability] = useState(service?.availability_note ?? "");
  const [skills, setSkills] = useState((service?.skills ?? []).join(", "));
  const [prices, setPrices] = useState<ServicePrice[]>(service?.prices ?? [emptyPrice("base")]);
  const [hours, setHours] = useState<ServiceHour[]>(service?.hours ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patch = <T,>(list: T[], index: number, changes: Partial<T>): T[] =>
    list.map((entry, position) => (position === index ? { ...entry, ...changes } : entry));

  const drop = <T,>(list: T[], index: number): T[] =>
    list.filter((_, position) => position !== index);

  const save = (status: "draft" | "pending") => {
    if (busy) return;

    const years = Number(experience);
    const input: ServiceInput = {
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      category,
      department,
      city: city.trim(),
      remote,
      fixed_price: fixedPrice,
      work_style: workStyle,
      experience_years: experience.trim() === "" || !Number.isFinite(years) ? null : years,
      availability_note: availability.trim(),
      /** Lo que la API valida contra una lista cerrada viaja solo si se
       * eligió: vacío no es una opción de la lista, es no haber elegido. */
      ...(responseTime ? { response_time: responseTime } : {}),
      status,
      skills: skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      /** Un precio en cero es "no lo puse": no viaja, para que no se publique
       * un servicio que dice costar nada. */
      prices: prices
        .filter((price) => price.amount > 0)
        .map(({ unit, ...rest }) => (unit ? { ...rest, unit } : rest)),
      hours,
    };

    setBusy(true);
    setError("");
    const work = service ? updateService(service.id, input) : createService(input);
    work
      .then(onSaved)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudo guardar");
      })
      .finally(() => setBusy(false));
  };

  return (
    <form
      className="rounded-2xl border border-sky/50 bg-surface p-5 shadow-[var(--shadow-hairline)]"
      onSubmit={(event) => {
        event.preventDefault();
        save("pending");
      }}
    >
      <h2 className="text-[15px] font-semibold text-ink">
        {service ? "Editar el servicio" : "Publicar un servicio"}
      </h2>
      <p className="mt-1 text-sm text-soft">
        Lo que mandes a revisión lo mira alguien antes de que se vea. Mientras tanto podés guardarlo
        como borrador y seguir después.
      </p>

      <div className="mt-4 space-y-3">
        <TextField
          label="Qué ofrecés"
          placeholder="Electricista a domicilio"
          value={title}
          onChange={setTitle}
        />

        <TextField
          label="En una línea"
          placeholder="Tableros, tomas y luces en el día"
          value={summary}
          onChange={setSummary}
        />

        <TextField
          label="Contalo en detalle"
          placeholder="Qué hacés, cómo trabajás y qué incluye."
          rows={6}
          value={description}
          onChange={setDescription}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Rubro">
            <Select
              label="Rubro"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
            />
          </Labelled>
          <Labelled label="Departamento">
            <Select
              label="Departamento"
              options={DEPARTMENT_OPTIONS}
              value={department}
              onChange={setDepartment}
            />
          </Labelled>
          <TextField label="Ciudad o barrio" value={city} onChange={setCity} />
          <Labelled label="Modalidad">
            <Select label="Modalidad" options={MODE_OPTIONS} value={remote} onChange={setRemote} />
          </Labelled>
          <Labelled label="Cómo trabajás">
            <Select
              label="Cómo trabajás"
              options={STYLE_OPTIONS}
              value={workStyle}
              onChange={setWorkStyle}
            />
          </Labelled>
          <Labelled label="Cuánto tardás en contestar">
            <Select
              label="Cuánto tardás en contestar"
              options={RESPONSE_OPTIONS}
              value={responseTime}
              onChange={setResponseTime}
            />
          </Labelled>
          <TextField
            inputMode="numeric"
            label="Años de experiencia"
            value={experience}
            onChange={(value) => setExperience(value.replace(/\D/g, ""))}
          />
          <TextField
            label="Habilidades, separadas por coma"
            placeholder="Tableros, luminarias, domótica"
            value={skills}
            onChange={setSkills}
          />
        </div>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Precios</h3>
          <div className="mt-2 space-y-2">
            {prices.map((price, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-sky/50 px-3 py-3 sm:grid-cols-[1fr_7rem_8rem_9rem_auto]"
              >
                <input
                  aria-label="Qué incluye"
                  className={inputClass}
                  placeholder={price.kind === "base" ? "Hora de trabajo" : "Salida fuera de zona"}
                  type="text"
                  value={price.label}
                  onChange={(event) =>
                    setPrices(patch(prices, index, { label: event.target.value }))
                  }
                />
                <input
                  aria-label="Monto"
                  className={inputClass}
                  inputMode="numeric"
                  type="text"
                  value={price.amount === 0 ? "" : String(price.amount)}
                  onChange={(event) =>
                    setPrices(
                      patch(prices, index, {
                        amount: Number(event.target.value.replace(/\D/g, "")),
                      }),
                    )
                  }
                />
                <Select
                  label="Moneda"
                  options={CURRENCY_OPTIONS}
                  value={price.currency}
                  onChange={(value) =>
                    setPrices(patch(prices, index, { currency: value as Currency }))
                  }
                />
                <Select
                  label="Unidad"
                  options={UNIT_OPTIONS}
                  value={price.unit}
                  onChange={(value) => setPrices(patch(prices, index, { unit: value }))}
                />
                <button
                  aria-label="Quitar precio"
                  className="justify-self-end rounded-lg p-2 text-muted transition-colors hover:text-ink"
                  type="button"
                  onClick={() => setPrices(drop(prices, index))}
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
              type="button"
              onClick={() => setPrices([...prices, emptyPrice("base")])}
            >
              <Plus aria-hidden className="size-3.5" />
              Agregar precio
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
              type="button"
              onClick={() => setPrices([...prices, emptyPrice("extra")])}
            >
              <Plus aria-hidden className="size-3.5" />
              Agregar extra
            </button>
          </div>

          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-soft">
            <input
              checked={fixedPrice}
              className="size-3.5 shrink-0 accent-sky"
              type="checkbox"
              onChange={(event) => setFixedPrice(event.target.checked)}
            />
            El precio es cerrado, no una referencia
          </label>
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Horarios</h3>
          <div className="mt-2 space-y-2">
            {hours.map((hour, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-sky/50 px-3 py-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
              >
                <Select
                  label="Día"
                  options={WEEKDAY_OPTIONS}
                  value={String(hour.weekday)}
                  onChange={(value) => setHours(patch(hours, index, { weekday: Number(value) }))}
                />
                <input
                  aria-label="Desde"
                  className={inputClass}
                  type="time"
                  value={hour.from}
                  onChange={(event) => setHours(patch(hours, index, { from: event.target.value }))}
                />
                <input
                  aria-label="Hasta"
                  className={inputClass}
                  type="time"
                  value={hour.to}
                  onChange={(event) => setHours(patch(hours, index, { to: event.target.value }))}
                />
                <button
                  aria-label="Quitar horario"
                  className="justify-self-end rounded-lg p-2 text-muted transition-colors hover:text-ink"
                  type="button"
                  onClick={() => setHours(drop(hours, index))}
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-mist hover:text-ink"
            type="button"
            onClick={() => setHours([...hours, emptyHour()])}
          >
            <Plus aria-hidden className="size-3.5" />
            Agregar día
          </button>

          <div className="mt-2">
            <TextField
              label="Aclaración sobre la disponibilidad"
              placeholder="Fuera de ese horario, urgencias con recargo."
              value={availability}
              onChange={setAvailability}
            />
          </div>
        </section>
      </div>

      {error ? <p className="mt-3 text-xs text-brand">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-colors hover:bg-brand disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Mandar a revisión
        </button>
        <button
          className="rounded-xl border border-sky/70 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => save("draft")}
        >
          Guardar borrador
        </button>
        <button
          className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
