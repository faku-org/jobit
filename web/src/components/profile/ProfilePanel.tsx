import { ChevronDown, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { COURSES, DEGREES } from "../../lib/catalog.ts";
import { fadeUpTransition } from "../../lib/motion.ts";
import {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  type EducationLevel,
  type Profile,
  withDegrees,
} from "../../lib/profile.ts";
import { type Usage, anonymousStats } from "../../lib/stats.ts";
import { pendingEvents } from "../../lib/track.ts";
import type { Facet, Preferences, Theme } from "../../lib/types.ts";
import { Combobox } from "../ui/Combobox.tsx";
import { CvImport } from "./CvImport.tsx";
import { DangerZone } from "./DangerZone.tsx";
import { ExperienceField } from "./ExperienceField.tsx";
import { PanelChip, PanelGroup } from "./PanelControls.tsx";

interface ProfilePanelProps {
  profile: Profile;
  usage: Usage;
  /** What the erase is about to throw away, so it can say it out loud before
   * doing it. */
  counts: { saved: number; applications: number; dismissed: number };
  /** Read only by the CV import, which can suggest rubros to prefer. */
  preferences: Preferences;
  categories: Facet[];
  /** How the app looks, which is not a search preference: it lives here with
   * the rest of what this browser knows about the person. */
  theme: Theme;
  onImportCv: (profile: Profile, preferences: Preferences) => void;
  onChange: (profile: Profile) => void;
  onChangeTheme: (theme: Theme) => void;
  onEraseEverything: () => void;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

/**
 * What the person studied, used to order the list and to tell whether an offer
 * asks for more than they have. It lives in this browser only; the switch at
 * the bottom governs the one thing that ever leaves, and shows it verbatim.
 */
export function ProfilePanel({
  profile,
  usage,
  counts,
  preferences,
  categories,
  theme,
  onChange,
  onChangeTheme,
  onImportCv,
  onEraseEverything,
}: ProfilePanelProps) {
  const [showPayload, setShowPayload] = useState(false);
  const payload = anonymousStats(profile, usage);
  /* Lo que está en la cola ahora mismo, no un ejemplo: si dice que no se
     manda el texto que escribiste, se puede comprobar acá. */
  const events = pendingEvents();

  const pickEducation = (level: EducationLevel) =>
    onChange({ ...profile, education: profile.education === level ? "" : level });

  return (
    <div className="space-y-5 px-4 pt-1 pb-4">
      <div className="flex gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
        <p className="text-[11px] leading-relaxed text-onpanel/75">
          Todo lo que cargues acá queda guardado <strong>en este navegador</strong>. No se sube a
          ninguna nube, no viaja a las empresas y no sale de tu computadora. Cambiar algo reordena
          las ofertas al toque.
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

      <Combobox
        entries={DEGREES}
        label="Títulos"
        placeholder="Buscá tu título: bachillerato, UTU, licenciatura…"
        selected={profile.degrees}
        onChange={(degrees) => onChange(withDegrees(profile, degrees))}
      />

      <Combobox
        entries={COURSES}
        label="Cursos y certificaciones"
        placeholder="Buscá: inglés, Excel, libreta, primeros auxilios…"
        selected={profile.courses}
        onChange={(courses) => onChange({ ...profile, courses })}
      />

      <ExperienceField
        value={profile.experienceYears}
        onChange={(experienceYears) => onChange({ ...profile, experienceYears })}
      />

      <div className="border-t border-onpanel/10 pt-3">
        <CvImport
          categories={categories}
          preferences={preferences}
          profile={profile}
          onApply={onImportCv}
        />
      </div>

      <div className="border-t border-onpanel/10 pt-3">
        <PanelGroup title="Apariencia">
          {THEME_OPTIONS.map((option) => (
            <PanelChip
              key={option.value}
              active={theme === option.value}
              onClick={() => onChangeTheme(option.value)}
            >
              <option.icon aria-hidden className="size-3.5" />
              {option.label}
            </PanelChip>
          ))}
        </PanelGroup>
      </div>

      <DangerZone counts={counts} onEraseEverything={onEraseEverything} />

      <div className="space-y-2 border-t border-onpanel/10 pt-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            checked={profile.shareStats}
            className="mt-0.5 size-3.5 shrink-0 accent-sky"
            type="checkbox"
            onChange={(event) => onChange({ ...profile, shareStats: event.target.checked })}
          />
          <span className="text-[11px] leading-relaxed text-onpanel/75">
            Compartir estadísticas anónimas de uso. Una vez por día: tu nivel educativo y cuántos
            títulos, cursos, guardadas y postulaciones tenés. Y mientras navegás: qué puesto estás
            buscando, qué filtros usás y a qué avisos les diste a “Postularme”. Sin nombre, sin
            identificador y sin el texto que escribís.
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
              className="overflow-x-auto rounded-lg bg-onpanel-wash p-2.5 text-[10px] leading-relaxed text-onpanel/80"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={fadeUpTransition}
            >
              {JSON.stringify({ resumen: payload, eventos: events }, null, 2)}
            </motion.pre>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
