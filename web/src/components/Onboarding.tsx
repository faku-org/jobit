import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  ListOrdered,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { COURSES, DEGREES } from "../lib/catalog.ts";
import { fadeUpTransition, islandTransition, stagger } from "../lib/motion.ts";
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
  toggleValue,
  withCategoryStances,
  withDepartmentStances,
} from "../lib/types.ts";
import { Combobox } from "./Combobox.tsx";
import { CvImport } from "./CvImport.tsx";
import { ExperienceField } from "./ExperienceField.tsx";
import { PanelChip, PanelGroup, StanceChips } from "./PanelControls.tsx";
import { PriorityList } from "./PriorityList.tsx";
import { SalaryRange } from "./SalaryRange.tsx";

interface OnboardingProps {
  profile: Profile;
  preferences: Preferences;
  categories: Facet[];
  departments: Facet[];
  /** False for a browser that already got the welcome and is only here again
   * because the configuration was restarted: it knows what JobIt is. */
  showWelcome: boolean;
  onWelcomeSeen: () => void;
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

/**
 * The welcome, the setup, the questions, and the beat that hands over to the
 * app. Landing straight on the list and having a dialog drop on top of it read
 * as an interruption, so the intro owns the screen until it is done.
 *
 * The welcome and the setup are two screens and not one because they answer
 * different questions: "qué es esto y adónde va lo que cargo" comes first and
 * once, "cómo querés arrancar" comes every time the configuration is redone.
 */
type Phase = "welcome" | "setup" | "steps" | "done";

/** Long enough to read one line, short enough that nobody waits for it. */
const HANDOVER_MS = 1100;
/** The intro dims out over the tail of that beat, so it hands the screen over
 * instead of vanishing off it. The app fades in on the same background. */
const FAREWELL_MS = 350;

const pesos = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

const PROMISES = [
  "Ninguna respuesta es obligatoria: podés saltear y completar después.",
  "Nada se descarta por no coincidir; lo que te calza sube y el resto baja.",
  "Todo se puede cambiar cuando quieras desde Preferencias.",
];

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

/** Shown in the two steps that need the board's own rubros and zonas. */
function WaitingForBoard() {
  return (
    <p className="rounded-xl bg-onpanel/10 px-3 py-2.5 text-xs leading-relaxed text-onpanel/60">
      Cargando los rubros y las zonas del momento…
    </p>
  );
}

/**
 * The body of a step, which says so when it holds more than it can show. A
 * phone draws no scrollbar, so a control below this fold is a control nobody
 * knows is there: the fade and the line are the only thing that gives it away.
 */
function StepBody({ children, step }: { children: ReactNode; step: string }) {
  const view = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const box = view.current;
    const inner = content.current;
    if (!box || !inner) return;

    const check = () => setMore(box.scrollHeight - box.scrollTop - box.clientHeight > 8);
    check();
    box.addEventListener("scroll", check, { passive: true });
    /** Answers change the height as they are given, not only on arrival. */
    const observer = new ResizeObserver(check);
    observer.observe(inner);

    return () => {
      box.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, [step]);

  return (
    <div className="relative">
      <div ref={view} className="max-h-[60svh] overflow-y-auto px-5 py-4 sm:max-h-[58svh]">
        <motion.div
          key={step}
          ref={content}
          animate={{ opacity: 1, x: 0 }}
          initial={{ opacity: 0, x: 12 }}
          transition={fadeUpTransition}
        >
          {children}
        </motion.div>
      </div>

      {more ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-panel via-panel to-transparent pb-2"
          initial={{ opacity: 0 }}
        >
          <span className="flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-[11px] font-medium text-onpanel/75 ring-1 ring-onpanel/15">
            <ChevronDown aria-hidden className="size-3.5" />
            Seguí bajando, hay más
          </span>
        </motion.div>
      ) : null}
    </div>
  );
}

/**
 * The first thing somebody sees. The profile used to be a panel you had to go
 * looking for, which meant the first list anyone got was the same generic one:
 * asking here costs a minute and the answers are already applied by the time
 * the list appears. Nothing is required and nothing leaves the browser.
 */
export function Onboarding({
  profile,
  preferences,
  categories,
  departments,
  showWelcome,
  onWelcomeSeen,
  onFinish,
}: OnboardingProps) {
  const [draftProfile, setDraftProfile] = useState<Profile>(profile);
  const [draftPreferences, setDraftPreferences] = useState<Preferences>(preferences);
  const [phase, setPhase] = useState<Phase>(showWelcome ? "welcome" : "setup");
  const [leaving, setLeaving] = useState(false);
  const [index, setIndex] = useState(0);
  /** A CV that gave nothing away is not worth a screen of its own: the
   * questions start, and this is the one line that explains why. */
  const [cvMissed, setCvMissed] = useState(false);

  const ready = categories.length > 0;

  /** The handover is a beat, not a gate: it runs itself out and leaves. */
  useEffect(() => {
    if (phase !== "done") return;

    const farewell = setTimeout(() => setLeaving(true), HANDOVER_MS - FAREWELL_MS);
    const handover = setTimeout(() => onFinish(draftProfile, draftPreferences), HANDOVER_MS);

    return () => {
      clearTimeout(farewell);
      clearTimeout(handover);
    };
  }, [phase, draftProfile, draftPreferences, onFinish]);

  const lines = summary(draftProfile, draftPreferences, categories);
  /** Whether there is anything to say back. The summary is the honest test:
   * counting preferences alone called a filled-in profile "nothing". */
  const answered = lines.length > 0;

  const pickEducation = (level: EducationLevel) =>
    setDraftProfile((current) => ({
      ...current,
      education: current.education === level ? "" : level,
    }));

  /**
   * One question per screen. Two of the old steps hid a control below the fold
   * of the card's own scroller on a phone, where there is no scrollbar to give
   * it away: the orden de preferencia and the sueldo were simply never seen.
   * Splitting costs a tap each and makes every control visible on arrival.
   */
  const steps: Step[] = [
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
      id: "skills",
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
            <p className="rounded-xl bg-onpanel/10 px-3 py-2.5 text-xs leading-relaxed text-onpanel/70">
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
      body: !ready ? (
        <WaitingForBoard />
      ) : (
        <StanceChips
          facets={categories}
          hint="Elegí los que te interesan. Los que ocultes no vuelven a aparecer en la lista."
          lists={categoryStances(draftPreferences)}
          title="Rubros"
          onChange={(lists) =>
            setDraftPreferences((current) => withCategoryStances(current, lists))
          }
        />
      ),
    },
    /** Only worth asking once there are two things to put in an order. */
    ...(draftPreferences.categories.length > 1
      ? [
          {
            id: "order",
            icon: ListOrdered,
            title: "¿Cuál preferís?",
            hint: "El primero pesa más que el segundo, y así con el resto.",
            body: (
              <PriorityList
                empty="Elegí más de un rubro para poder ordenarlos."
                labelOf={(value: string) =>
                  categories.find((facet) => facet.value === value)?.label
                }
                title="Tu orden de preferencia"
                values={draftPreferences.categories}
                onChange={(values: string[]) =>
                  setDraftPreferences((current) => ({ ...current, categories: values }))
                }
              />
            ),
          },
        ]
      : []),
    {
      id: "where",
      icon: MapPin,
      title: "¿Dónde podés trabajar?",
      hint: "La zona ordena la lista; solo lo que ocultes queda afuera.",
      body: !ready ? (
        <WaitingForBoard />
      ) : (
        <StanceChips
          facets={departments.slice(0, 19)}
          hint="Priorizá tu departamento y sacá los que te quedan lejos."
          lists={departmentStances(draftPreferences)}
          title="Zona"
          onChange={(lists) =>
            setDraftPreferences((current) => withDepartmentStances(current, lists))
          }
        />
      ),
    },
    {
      id: "pay",
      icon: Wallet,
      title: "¿Cuánto necesitás ganar?",
      hint: "Las que no llegan bajan, y las que no publican sueldo podés dejarlas o sacarlas.",
      body: (
        <SalaryRange
          value={draftPreferences.salary}
          onChange={(salary) => setDraftPreferences((current) => ({ ...current, salary }))}
        />
      ),
    },
    {
      id: "shape",
      icon: Briefcase,
      title: "¿Cómo querés trabajar?",
      hint: "Lo último antes del resumen.",
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
        </div>
      ),
    },
    {
      id: "summary",
      icon: ClipboardCheck,
      title: "Así va a quedar tu lista",
      hint: "Revisá que sea lo que querías. Se cambia cuando quieras desde Preferencias.",
      body:
        lines.length === 0 ? (
          <p className="rounded-xl bg-onpanel/10 px-3 py-3 text-sm leading-relaxed text-onpanel/70">
            No cargaste nada, así que vas a ver todas las ofertas ordenadas por fecha. Podés
            completarlo cuando quieras desde Preferencias.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {lines.map((line) => (
              <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-onpanel/80">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
                {line}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  const step = steps[index];
  const isLast = index === steps.length - 1;
  /** Skipping is finishing without the answers of this run, not postponing the
   * question: on a first visit that leaves everything empty, and on a rerun it
   * leaves what was already saved exactly as it was. */
  const skip = () => onFinish(profile, preferences);
  const back = () => (index === 0 ? setPhase("setup") : setIndex((current) => current - 1));

  /** Read once: what the welcome says does not change, and somebody who
   * restarts the configuration is not asking to be introduced again. */
  const leaveWelcome = () => {
    onWelcomeSeen();
    setPhase("setup");
  };

  /** The CV answers the first two steps, so a good reading starts at the third
   * with what it found already loaded and every chip still editable. */
  const startAt = (id: string) => {
    const position = steps.findIndex((entry) => entry.id === id);
    setIndex(position < 0 ? 0 : position);
    setPhase("steps");
  };

  return (
    <motion.div
      animate={{ opacity: leaving ? 0 : 1 }}
      className="fixed inset-0 z-[60] overflow-y-auto bg-mist"
      transition={{ duration: leaving ? FAREWELL_MS / 1000 : 0 }}
    >
      <div className="mx-auto flex min-h-svh max-w-lg items-center px-5 py-7 sm:py-10">
        {phase === "welcome" ? (
          <motion.section
            key="welcome"
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
            initial={{ opacity: 0, y: 16 }}
            transition={fadeUpTransition}
          >
            <motion.img
              alt=""
              animate={{ scale: 1, opacity: 1 }}
              className="size-12 rounded-2xl shadow-[var(--shadow-match)] sm:size-14"
              initial={{ scale: 0.8, opacity: 0 }}
              src="/logo.png"
              transition={islandTransition}
              width={56}
              height={56}
            />

            <h1 className="mt-4 text-2xl leading-tight font-semibold tracking-tight text-ink sm:mt-5 sm:text-[28px]">
              Bienvenido a JobIt
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              Juntamos en un solo lugar las ofertas de trabajo de Uruguay, de todos los rubros y de
              todos los portales, con y sin experiencia.
            </p>

            <div className="mt-5 flex gap-2.5 rounded-2xl border border-sky/60 bg-surface px-4 py-3 sm:mt-6">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-sm leading-relaxed text-ink/70">
                Lo que hagas acá <strong className="font-semibold">no sube a ninguna nube</strong>.
                No hay cuenta ni contraseña: todo queda guardado en este navegador y las empresas no
                ven nada de esto.
              </p>
            </div>

            <div className="mt-6 sm:mt-7">
              <motion.button
                className="inline-flex items-center gap-2 rounded-2xl bg-panel px-5 py-3 text-sm font-semibold text-onpanel shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90"
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={leaveWelcome}
              >
                Entendido, seguimos
                <ArrowRight aria-hidden className="size-4" />
              </motion.button>
            </div>
          </motion.section>
        ) : phase === "setup" ? (
          <motion.section
            key="setup"
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
            initial={{ opacity: 0, y: 16 }}
            transition={fadeUpTransition}
          >
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-[28px]">
              Armemos tu lista
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              Un minuto de preguntas y la lista sale ordenada para vos desde la primera vez. Si
              tenés el CV a mano, lo leo y te salteo la mitad.
            </p>

            <ul className="mt-5 space-y-2 sm:mt-6 sm:space-y-2.5">
              {PROMISES.map((promise, position) => (
                <motion.li
                  key={promise}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5 text-sm leading-relaxed text-ink/70"
                  initial={{ opacity: 0, y: 8 }}
                  transition={{ ...fadeUpTransition, delay: stagger(position + 1, 0.07, 0.3) }}
                >
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                  {promise}
                </motion.li>
              ))}
            </ul>

            {/* El atajo: las dos primeras preguntas ya están contestadas en el
                CV de quien lo tiene a mano. */}
            <div className="mt-5 rounded-[22px] bg-panel px-4 py-4 text-onpanel shadow-[var(--shadow-panel)] sm:mt-6">
              <CvImport
                categories={categories}
                preferences={draftPreferences}
                profile={draftProfile}
                title="Subí tu CV y te completo esto"
                onApply={(profile, preferences) => {
                  setDraftProfile(profile);
                  setDraftPreferences(preferences);
                  startAt("areas");
                }}
                onEmpty={() => {
                  setCvMissed(true);
                  startAt("studies");
                }}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-7">
              <motion.button
                className="inline-flex items-center gap-2 rounded-2xl bg-panel px-5 py-3 text-sm font-semibold text-onpanel shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90"
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setPhase("steps")}
              >
                Prefiero contestar yo
                <ArrowRight aria-hidden className="size-4" />
              </motion.button>
              <button
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink/55 transition-colors hover:bg-surface hover:text-ink"
                type="button"
                onClick={skip}
              >
                Ver las ofertas sin configurar
              </button>
            </div>
          </motion.section>
        ) : phase === "done" ? (
          <motion.section
            key="done"
            animate={{ opacity: 1, y: 0 }}
            className="w-full text-center"
            initial={{ opacity: 0, y: 16 }}
            transition={fadeUpTransition}
          >
            <motion.span
              animate={{ scale: 1 }}
              className="mx-auto grid size-14 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-match)]"
              initial={{ scale: 0.7 }}
              transition={islandTransition}
            >
              <Check aria-hidden className="size-7" />
            </motion.span>

            <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">
              {answered ? "Listo, tu lista está armada" : "Listo, vamos a las ofertas"}
            </h2>
            <p className="mt-1.5 text-sm text-ink/60">
              {lines.length > 0
                ? lines[0]
                : "Vas a ver todas las ofertas, de la más nueva a la más vieja."}
            </p>
          </motion.section>
        ) : step ? (
          <motion.section
            key="steps"
            animate={{ opacity: 1, y: 0 }}
            aria-labelledby="onboarding-title"
            className="w-full overflow-hidden rounded-[26px] bg-panel text-onpanel shadow-[var(--shadow-panel)] ring-1 ring-onpanel/10"
            initial={{ opacity: 0, y: 16 }}
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
                  className="text-[17px] leading-tight font-semibold tracking-tight text-balance sm:truncate"
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

            {cvMissed && index === 0 ? (
              <p className="mx-5 mt-2 rounded-lg bg-onpanel/10 px-2.5 py-2 text-[11px] leading-relaxed text-onpanel/70">
                Del archivo no salió nada de la lista, así que vamos por las preguntas. Podés volver
                a probar con otro archivo desde Perfil.
              </p>
            ) : null}

            <StepBody step={step.id}>{step.body}</StepBody>

            <div className="mt-3 flex items-center gap-2 border-t border-onpanel/10 px-5 py-3.5">
              <button
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-onpanel/60 transition-colors hover:bg-onpanel/10 hover:text-onpanel"
                type="button"
                onClick={back}
              >
                <ArrowLeft aria-hidden className="size-3.5" />
                Atrás
              </button>

              <motion.button
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-sky px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-sky/85"
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => (isLast ? setPhase("done") : setIndex((current) => current + 1))}
              >
                {isLast ? (answered ? "Ver mis ofertas" : "Ver las ofertas") : "Siguiente"}
                {isLast ? (
                  <Check aria-hidden className="size-4" />
                ) : (
                  <ArrowRight aria-hidden className="size-4" />
                )}
              </motion.button>
            </div>
          </motion.section>
        ) : null}
      </div>
    </motion.div>
  );
}
