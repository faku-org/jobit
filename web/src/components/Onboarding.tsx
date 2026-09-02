import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { COURSES, DEGREES } from "../lib/catalog.ts";
import { fadeUpTransition, islandTransition } from "../lib/motion.ts";
import {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  type EducationLevel,
  type Profile,
  withDegrees,
} from "../lib/profile.ts";
import type { Facet, JobType, Level, Preferences, WorkMode } from "../lib/types.ts";
import {
  categoryStances,
  departmentStances,
  hiddenCount,
  preferenceCount,
  toggleValue,
  withCategoryStances,
  withDepartmentStances,
} from "../lib/types.ts";
import { Combobox } from "./Combobox.tsx";
import { ExperienceField } from "./ExperienceField.tsx";
import { PanelChip, PanelGroup, StanceChips } from "./PanelControls.tsx";
import { PriorityList } from "./PriorityList.tsx";
import { SalaryRange } from "./SalaryRange.tsx";

interface OnboardingProps {
  profile: Profile;
  preferences: Preferences;
  categories: Facet[];
  departments: Facet[];
  onFinish: (profile: Profile, preferences: Preferences) => void;
}

const MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: "onsite", label: "Presencial" },
  { value: "remote", label: "Remoto" },
  { value: "hybrid", label: "Híbrido" },
];

const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: "full_time", label: "Jornada completa" },
  { value: "part_time", label: "Medio horario" },
  { value: "internship", label: "Pasantía" },
];

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "entry", label: "Junior" },
  { value: "mid", label: "Semi senior" },
  { value: "senior", label: "Senior" },
];

interface Step {
  id: string;
  icon: typeof Target;
  title: string;
  hint: string;
  body: ReactNode;
}

const pesos = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

/** What the answers add up to, said back in the words the person used. */
function summary(profile: Profile, preferences: Preferences, categories: Facet[]): string[] {
  const lines: string[] = [];
  const named = preferences.categories
    .map((value) => categories.find((facet) => facet.value === value)?.label ?? value)
    .slice(0, 3);

  if (named.length > 0) lines.push(`Primero, ofertas de ${named.join(", ")}.`);
  if (preferences.departments.length > 0) {
    lines.push(`Cerca de ${preferences.departments.join(", ")}.`);
  }
  if (preferences.salary.min !== null) {
    lines.push(`Apuntando a $ ${pesos.format(preferences.salary.min)} o más por mes.`);
  }
  if (profile.education !== "") {
    lines.push(`Con lo que pide un nivel ${EDUCATION_LABEL[profile.education].toLowerCase()}.`);
  }
  if (profile.experienceYears === 0) lines.push("Priorizando las que no piden experiencia.");
  const hidden = hiddenCount(preferences);
  if (hidden === 1) lines.push("Y sin el rubro o la zona que sacaste.");
  if (hidden > 1) lines.push(`Y sin los ${hidden} rubros y zonas que sacaste.`);

  return lines;
}

/**
 * The first thing somebody sees. The profile used to be a panel you had to go
 * looking for, which meant the first list anyone got was the same generic one:
 * asking here costs a minute and every answer is already applied when the
 * feed appears behind it. Nothing is required and nothing leaves the browser.
 */
export function Onboarding({
  profile,
  preferences,
  categories,
  departments,
  onFinish,
}: OnboardingProps) {
  const [draftProfile, setDraftProfile] = useState<Profile>(profile);
  const [draftPreferences, setDraftPreferences] = useState<Preferences>(preferences);
  const [index, setIndex] = useState(0);

  const pickEducation = (level: EducationLevel) =>
    setDraftProfile((current) => ({
      ...current,
      education: current.education === level ? "" : level,
    }));

  const steps: Step[] = [
    {
      id: "welcome",
      icon: Briefcase,
      title: "Armemos tu búsqueda",
      hint: "Un minuto de preguntas y la lista queda ordenada para vos desde la primera vez.",
      body: (
        <div className="space-y-3">
          <div className="flex gap-2.5 rounded-xl bg-onpanel/10 px-3 py-2.5">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
            <p className="text-xs leading-relaxed text-onpanel/75">
              Todo queda guardado <strong>en este navegador</strong>. No hay cuenta, no se sube a
              ninguna nube y las empresas no ven nada de esto.
            </p>
          </div>
          <ul className="space-y-2 text-xs leading-relaxed text-onpanel/70">
            <li className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky" />
              Ninguna respuesta es obligatoria: podés saltear y completar después.
            </li>
            <li className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky" />
              Nada se descarta por no coincidir; lo que te calza sube y el resto baja.
            </li>
            <li className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky" />
              Todo se puede cambiar cuando quieras desde Preferencias.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "studies",
      icon: GraduationCap,
      title: "¿Qué estudiaste?",
      hint: "Sirve para bajar las ofertas que piden más de lo que tenés y subir las que te calzan.",
      body: (
        <div className="space-y-5">
          <PanelGroup title="Nivel educativo">
            {EDUCATION_LEVELS.map((level) => (
              <PanelChip
                key={level}
                active={draftProfile.education === level}
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
            selected={draftProfile.degrees}
            onChange={(degrees) => setDraftProfile((current) => withDegrees(current, degrees))}
          />
        </div>
      ),
    },
    {
      id: "experience",
      icon: Sparkles,
      title: "¿Y qué sabés hacer?",
      hint: "Cursos, certificaciones y carnés cuentan tanto como un título en muchos avisos.",
      body: (
        <div className="space-y-5">
          <Combobox
            entries={COURSES}
            label="Cursos y certificaciones"
            placeholder="Buscá: inglés, Excel, libreta de conducir, primeros auxilios…"
            selected={draftProfile.courses}
            onChange={(courses) => setDraftProfile((current) => ({ ...current, courses }))}
          />

          <ExperienceField
            value={draftProfile.experienceYears}
            onChange={(experienceYears) =>
              setDraftProfile((current) => ({ ...current, experienceYears }))
            }
          />

          {draftProfile.experienceYears === 0 ? (
            <p className="rounded-xl bg-onpanel/10 px-3 py-2.5 text-[11px] leading-relaxed text-onpanel/70">
              Perfecto: las ofertas marcadas “sin experiencia” van a quedar arriba de todo.
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "areas",
      icon: Target,
      title: "¿En qué te gustaría trabajar?",
      hint: "Tocá una vez para priorizar el rubro, otra para ocultarlo del todo.",
      body: (
        <div className="space-y-5">
          <StanceChips
            facets={categories}
            hint="Elegí los que te interesan. Los que ocultes no vuelven a aparecer en la lista."
            lists={categoryStances(draftPreferences)}
            title="Rubros"
            onChange={(lists) =>
              setDraftPreferences((current) => withCategoryStances(current, lists))
            }
          />

          <PriorityList
            empty="Cuando elijas más de uno vas a poder ordenarlos: el primero es el que preferís sobre el resto."
            labelOf={(value) => categories.find((facet) => facet.value === value)?.label}
            title="Tu orden de preferencia"
            values={draftPreferences.categories}
            onChange={(values) =>
              setDraftPreferences((current) => ({ ...current, categories: values }))
            }
          />
        </div>
      ),
    },
    {
      id: "where",
      icon: MapPin,
      title: "¿Dónde y por cuánto?",
      hint: "La zona y el sueldo ordenan la lista; solo lo que ocultes queda afuera.",
      body: (
        <div className="space-y-5">
          <StanceChips
            facets={departments.slice(0, 19)}
            hint="Priorizá tu departamento y sacá los que te quedan lejos."
            lists={departmentStances(draftPreferences)}
            title="Zona"
            onChange={(lists) =>
              setDraftPreferences((current) => withDepartmentStances(current, lists))
            }
          />

          <SalaryRange
            value={draftPreferences.salary}
            onChange={(salary) => setDraftPreferences((current) => ({ ...current, salary }))}
          />
        </div>
      ),
    },
    {
      id: "shape",
      icon: Briefcase,
      title: "¿Cómo querés trabajar?",
      hint: "Lo último. Después la lista queda armada.",
      body: (
        <div className="space-y-5">
          <PanelGroup title="Modalidad">
            {MODE_OPTIONS.map((option) => (
              <PanelChip
                key={option.value}
                active={draftPreferences.modes.includes(option.value)}
                onClick={() =>
                  setDraftPreferences((current) => ({
                    ...current,
                    modes: toggleValue(current.modes, option.value),
                  }))
                }
              >
                {option.label}
              </PanelChip>
            ))}
          </PanelGroup>

          <PanelGroup title="Jornada">
            {JOB_TYPE_OPTIONS.map((option) => (
              <PanelChip
                key={option.value}
                active={draftPreferences.jobTypes.includes(option.value)}
                onClick={() =>
                  setDraftPreferences((current) => ({
                    ...current,
                    jobTypes: toggleValue(current.jobTypes, option.value),
                  }))
                }
              >
                {option.label}
              </PanelChip>
            ))}
          </PanelGroup>

          <PanelGroup title="Nivel del puesto">
            {LEVEL_OPTIONS.map((option) => (
              <PanelChip
                key={option.value}
                active={draftPreferences.levels.includes(option.value)}
                onClick={() =>
                  setDraftPreferences((current) => ({
                    ...current,
                    levels: toggleValue(current.levels, option.value),
                  }))
                }
              >
                {option.label}
              </PanelChip>
            ))}
          </PanelGroup>

          <div className="rounded-xl bg-onpanel/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">
              Así va a quedar tu lista
            </p>
            {summary(draftProfile, draftPreferences, categories).length === 0 ? (
              <p className="mt-1.5 text-xs leading-relaxed text-onpanel/70">
                No cargaste nada todavía, así que vas a ver todas las ofertas ordenadas por fecha.
                Se puede completar cuando quieras desde Preferencias.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {summary(draftProfile, draftPreferences, categories).map((line) => (
                  <li key={line} className="flex gap-2 text-xs leading-relaxed text-onpanel/75">
                    <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky" />
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ),
    },
  ];

  const step = steps[index];
  if (!step) return null;

  const isLast = index === steps.length - 1;
  const finish = () => onFinish(draftProfile, draftPreferences);
  /** Skipping is finishing without the answers of this run, not postponing the
   * question: on a first visit that leaves everything empty, and on a rerun it
   * leaves what was already saved exactly as it was. */
  const skip = () => onFinish(profile, preferences);

  const answered = preferenceCount(draftPreferences) + hiddenCount(draftPreferences) > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-[var(--scrim)] p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="onboarding-title"
        aria-modal="true"
        className="my-auto w-full max-w-lg overflow-hidden rounded-[26px] bg-panel text-onpanel shadow-[var(--shadow-panel)] ring-1 ring-onpanel/10"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        transition={islandTransition}
      >
        <div className="flex items-center gap-3 px-5 pt-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white">
            <step.icon aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-onpanel/50 tabular-nums">
              Paso {index + 1} de {steps.length}
            </p>
            <h2
              className="truncate text-[17px] leading-tight font-semibold tracking-tight"
              id="onboarding-title"
            >
              {step.title}
            </h2>
          </div>
          <button
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-onpanel/50 transition-colors hover:bg-onpanel/10 hover:text-onpanel"
            type="button"
            onClick={skip}
          >
            Saltear
          </button>
        </div>

        <div className="mt-3 flex gap-1 px-5">
          {steps.map((entry, position) => (
            <span
              key={entry.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                position <= index ? "bg-sky" : "bg-onpanel/15"
              }`}
            />
          ))}
        </div>

        <p className="px-5 pt-3 text-xs leading-relaxed text-onpanel/60">{step.hint}</p>

        <div className="max-h-[58svh] overflow-y-auto px-5 py-4">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={step.id}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              initial={{ opacity: 0, x: 12 }}
              transition={fadeUpTransition}
            >
              {step.body}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-onpanel/10 px-5 py-3.5">
          {index > 0 ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-onpanel/60 transition-colors hover:bg-onpanel/10 hover:text-onpanel"
              type="button"
              onClick={() => setIndex((current) => current - 1)}
            >
              <ArrowLeft aria-hidden className="size-3.5" />
              Atrás
            </button>
          ) : null}

          <motion.button
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-sky px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-sky/85"
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
          >
            {isLast ? (answered ? "Ver mis ofertas" : "Ver las ofertas") : "Siguiente"}
            {isLast ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <ArrowRight aria-hidden className="size-4" />
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
