interface ExperienceFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  tone?: "panel" | "surface";
}

/** Nobody counts past this, and the offers stop distinguishing well before. */
const MAX_YEARS = 20;

const OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Ninguna" },
  { value: 1, label: "1 año" },
  { value: 2, label: "2 años" },
  { value: 3, label: "3 años" },
  { value: 5, label: "5 años" },
  { value: 8, label: "8 años" },
  { value: 12, label: "12 años" },
  { value: MAX_YEARS, label: "20 o más" },
];

/**
 * Years of experience as a row of chips instead of a number box. The offers
 * only ever ask for round numbers, and "0" has to be as easy to say as "3":
 * it is the answer that turns on the first-job offers.
 */
export function ExperienceField({ value, onChange, tone = "panel" }: ExperienceFieldProps) {
  const muted = tone === "panel" ? "text-onpanel-muted" : "text-muted";
  const active = tone === "panel" ? "bg-sky text-ink" : "bg-panel text-onpanel";
  const idle =
    tone === "panel"
      ? "bg-onpanel-wash text-onpanel/75 hover:bg-onpanel/20 hover:text-onpanel"
      : "bg-mist text-soft hover:bg-sky/50 hover:text-ink";

  return (
    <div>
      <p className={`text-[11px] font-semibold tracking-wide uppercase ${muted}`}>
        Años de experiencia
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            aria-pressed={value === option.value}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              value === option.value ? active : idle
            }`}
            type="button"
            onClick={() => onChange(value === option.value ? null : option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
