import { ChevronDown, Plus, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { fadeUpTransition } from "../lib/motion.ts";
import {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  type EducationLevel,
  type Profile,
} from "../lib/profile.ts";
import { type Usage, anonymousStats } from "../lib/stats.ts";
import { PanelChip, PanelGroup } from "./PanelControls.tsx";

interface ProfilePanelProps {
  profile: Profile;
  usage: Usage;
  onChange: (profile: Profile) => void;
}

const MAX_ENTRIES = 24;
const MAX_ENTRY_LENGTH = 120;

const inputClass =
  "w-full rounded-lg border border-onpanel/20 bg-onpanel/5 px-2.5 py-1.5 text-xs text-onpanel outline-none transition-colors placeholder:text-onpanel/40 focus:border-sky";

/** A list of short free-text entries: títulos, cursos. */
function EntryList({
  title,
  placeholder,
  entries,
  onChange,
}: {
  title: string;
  placeholder: string;
  entries: string[];
  onChange: (entries: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim().slice(0, MAX_ENTRY_LENGTH);
    if (!value || entries.includes(value) || entries.length >= MAX_ENTRIES) return setDraft("");
    onChange([...entries, value]);
    setDraft("");
  };

  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">{title}</p>

      {entries.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <span
              key={entry}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky px-3 py-1.5 text-xs font-medium text-ink"
            >
              <span className="truncate">{entry}</span>
              <button
                aria-label={`Quitar ${entry}`}
                className="shrink-0 rounded-full text-ink/60 transition-colors hover:text-ink"
                type="button"
                onClick={() => onChange(entries.filter((item) => item !== entry))}
              >
                <X aria-hidden className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form className="mt-2 flex gap-1.5" onSubmit={add}>
        <input
          aria-label={title}
          className={inputClass}
          maxLength={MAX_ENTRY_LENGTH}
          placeholder={placeholder}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          aria-label={`Agregar a ${title}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-onpanel/10 px-2.5 text-xs font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
          type="submit"
        >
          <Plus aria-hidden className="size-3.5" />
          Agregar
        </button>
      </form>
    </div>
  );
}

/**
 * What the person studied, used to tell whether an offer asks for more than
 * they have. It lives in this browser only; the switch at the bottom governs
 * the one thing that ever leaves, and shows it verbatim.
 */
export function ProfilePanel({ profile, usage, onChange }: ProfilePanelProps) {
  const [showPayload, setShowPayload] = useState(false);
  const payload = anonymousStats(profile, usage);

  const pickEducation = (level: EducationLevel) =>
    onChange({ ...profile, education: profile.education === level ? "" : level });

  return (
    <div className="space-y-4 px-4 pt-1 pb-4">
      <div className="flex gap-2.5 rounded-xl bg-onpanel/10 px-3 py-2.5">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
        <p className="text-[11px] leading-relaxed text-onpanel/75">
          Todo lo que cargues acá queda guardado <strong>en este navegador</strong>. No se sube a
          ninguna nube, no viaja a las empresas y no sale de tu computadora.
        </p>
      </div>

      <PanelGroup title="Nivel educativo">
        {EDUCATION_LEVELS.map((level) => (
          <PanelChip
            key={level}
            active={profile.education === level}
            onClick={() => pickEducation(level)}
          >
            {EDUCATION_LABEL[level]}
          </PanelChip>
        ))}
      </PanelGroup>

      <EntryList
        entries={profile.degrees}
        placeholder="Ej: Bachillerato en Ciencias Biológicas"
        title="Títulos"
        onChange={(degrees) => onChange({ ...profile, degrees })}
      />

      <EntryList
        entries={profile.courses}
        placeholder="Ej: Inglés B2, Excel avanzado"
        title="Cursos"
        onChange={(courses) => onChange({ ...profile, courses })}
      />

      <div>
        <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">
          Años de experiencia
        </p>
        <input
          aria-label="Años de experiencia"
          className={`${inputClass} mt-2 w-24`}
          max={60}
          min={0}
          placeholder="Ej: 3"
          type="number"
          value={profile.experienceYears ?? ""}
          onChange={(event) =>
            onChange({
              ...profile,
              experienceYears: event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </div>

      <div className="space-y-2 border-t border-onpanel/10 pt-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            checked={profile.shareStats}
            className="mt-0.5 size-3.5 shrink-0 accent-sky"
            type="checkbox"
            onChange={(event) => onChange({ ...profile, shareStats: event.target.checked })}
          />
          <span className="text-[11px] leading-relaxed text-onpanel/75">
            Compartir estadísticas anónimas de uso. Se manda una vez por día: tu nivel educativo y
            cuántos títulos, cursos, guardadas y postulaciones tenés. Sin nombre, sin identificador
            y sin el texto que escribiste.
          </span>
        </label>

        <button
          aria-expanded={showPayload}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-onpanel/60 transition-colors hover:text-onpanel"
          type="button"
          onClick={() => setShowPayload((current) => !current)}
        >
          <ChevronDown
            aria-hidden
            className={`size-3 transition-transform ${showPayload ? "rotate-180" : ""}`}
          />
          Ver exactamente qué se envía
        </button>

        <AnimatePresence initial={false}>
          {showPayload ? (
            <motion.pre
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-x-auto rounded-lg bg-onpanel/10 p-2.5 text-[10px] leading-relaxed text-onpanel/80"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={fadeUpTransition}
            >
              {JSON.stringify(payload, null, 2)}
            </motion.pre>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
