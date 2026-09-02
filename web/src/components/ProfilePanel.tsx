import { ChevronDown, RotateCcw, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { COURSES, DEGREES } from "../lib/catalog.ts";
import { fadeUpTransition } from "../lib/motion.ts";
import {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  type EducationLevel,
  type Profile,
  withDegrees,
} from "../lib/profile.ts";
import { type Usage, anonymousStats } from "../lib/stats.ts";
import type { Facet, Preferences } from "../lib/types.ts";
import { Combobox } from "./Combobox.tsx";
import { CvImport } from "./CvImport.tsx";
import { DangerZone } from "./DangerZone.tsx";
import { ExperienceField } from "./ExperienceField.tsx";
import { PanelChip, PanelGroup } from "./PanelControls.tsx";

interface ProfilePanelProps {
  profile: Profile;
  usage: Usage;
  /** What the danger zone is about to erase, so it can say it out loud. */
  counts: { saved: number; applications: number; dismissed: number; preferences: number };
  /** Read only by the CV import, which can suggest rubros to prefer. */
  preferences: Preferences;
  categories: Facet[];
  onImportCv: (profile: Profile, preferences: Preferences) => void;
  onChange: (profile: Profile) => void;
  onRestartOnboarding: () => void;
  onResetPreferences: () => void;
  onEraseEverything: () => void;
}

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
  onChange,
  onImportCv,
  onRestartOnboarding,
  onResetPreferences,
  onEraseEverything,
}: ProfilePanelProps) {
  const [showPayload, setShowPayload] = useState(false);
  const payload = anonymousStats(profile, usage);

  const pickEducation = (level: EducationLevel) =>
    onChange({ ...profile, education: profile.education === level ? "" : level });

  return (
    <div className="space-y-5 px-4 pt-1 pb-4">
      <div className="flex gap-2.5 rounded-xl bg-onpanel/10 px-3 py-2.5">
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

      <button
        className="inline-flex items-center gap-1.5 rounded-lg bg-onpanel/10 px-2.5 py-1.5 text-[11px] font-medium text-onpanel/75 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
        type="button"
        onClick={onRestartOnboarding}
      >
        <RotateCcw aria-hidden className="size-3" />
        Rehacer la configuración inicial
      </button>

      <CvImport
        categories={categories}
        preferences={preferences}
        profile={profile}
        onApply={onImportCv}
      />

      <DangerZone
        counts={counts}
        onEraseEverything={onEraseEverything}
        onResetPreferences={onResetPreferences}
      />

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
            y sin cuáles son.
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
