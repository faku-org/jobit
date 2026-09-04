import { Check, FileUp, Plus, ShieldCheck, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import type { OrbState } from "thinking-orbs";
import { holdBusy } from "../hooks/useSettlingBusy.ts";
import { COURSES, DEGREES } from "../lib/catalog.ts";
import { type CvReading, EMPTY_READING, isEmptyReading, readCv } from "../lib/cv.ts";
import { fadeUpTransition, stagger } from "../lib/motion.ts";
import { EDUCATION_LABEL, type Profile } from "../lib/profile.ts";
import type { Facet, Preferences } from "../lib/types.ts";
import { Aura, AuraSpark } from "./Aura.tsx";

/** Las auras de acá viven sobre el panel y no sobre una tarjeta. */
const ON_PANEL = "[--aura-base:var(--color-panel)] [--aura-tone:40%]";

interface CvImportProps {
  profile: Profile;
  preferences: Preferences;
  categories: Facet[];
  onApply: (profile: Profile, preferences: Preferences) => void;
  title?: string;
  onEmpty?: () => void;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPT = ".pdf,.txt,.md,.markdown,text/plain,application/pdf";

type Stage = "idle" | "uploading" | "analyzing" | "answered" | "review";

const BEAT: Record<
  Exclude<Stage, "idle" | "review">,
  { label: string; orb: OrbState; ms: number }
> = {
  uploading: { label: "Subiendo archivo…", orb: "listening", ms: 900 },
  analyzing: { label: "Analizando CV…", orb: "searching", ms: 1800 },
  answered: { label: "CV analizado", orb: "composing", ms: 1100 },
};

const labelOf = (id: string): string =>
  [...DEGREES, ...COURSES].find((entry) => entry.id === id)?.label ?? id;

function Pick({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        checked
          ? "bg-brand/85 text-ink"
          : "bg-onpanel-wash text-onpanel-muted hover:bg-onpanel-wash"
      }`}
      type="button"
      onClick={onToggle}
    >
      {checked ? <Check aria-hidden className="size-3" /> : null}
      {label}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ProgressBeat({ stage }: { stage: Exclude<Stage, "idle" | "review"> }) {
  const beat = BEAT[stage];

  return (
    <Aura busy className={`rounded-xl ${ON_PANEL}`} intro={false}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <AuraSpark intro={false} state={beat.orb} tone="panel" />
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-medium text-onpanel"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            transition={fadeUpTransition}
          >
            {beat.label}
          </motion.p>
        </AnimatePresence>
      </div>
    </Aura>
  );
}

/**
 * Reads a CV — or a LinkedIn profile saved as PDF — and matches it against the
 * same closed lists the profile uses. The file is opened in this browser and
 * nothing is uploaded; there is no server that could receive it.
 */
export function CvImport({
  profile,
  preferences,
  categories,
  onApply,
  onEmpty,
  title = "Importar tu CV",
}: CvImportProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [reading, setReading] = useState<CvReading>(EMPTY_READING);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const readTicket = useRef(0);

  useEffect(
    () => () => {
      readTicket.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (stage !== "review") return;
    reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [stage]);

  const kept = (key: string) => !dropped.has(key);
  const toggle = (key: string) =>
    setDropped((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const finish = (found: CvReading) => {
    if (isEmptyReading(found) && onEmpty) {
      setStage("idle");
      setError(null);
      onEmpty();
      return;
    }

    setReading(found);
    setDropped(new Set());
    setStage("review");
    if (isEmptyReading(found)) {
      setError(
        found.characters < 40
          ? "Casi no se pudo leer texto. Si el PDF es una foto escaneada, probá pegando el texto a mano."
          : "Se leyó el archivo pero no reconocí títulos ni cursos de la lista. Podés cargarlos a mano.",
      );
    } else {
      setError(null);
    }
  };

  const runReading = async (source: () => Promise<string>, fromFile: boolean) => {
    const ticket = ++readTicket.current;
    setError(null);
    const live = (next: Stage) => ticket === readTicket.current && setStage(next);

    try {
      if (fromFile) {
        live("uploading");
        const uploadStarted = performance.now();
        const text = await source();
        await holdBusy(uploadStarted, BEAT.uploading.ms);
        if (ticket !== readTicket.current) return;

        live("analyzing");
        const analyzeStarted = performance.now();
        const found = readCv(text);
        await holdBusy(analyzeStarted, BEAT.analyzing.ms);
        if (ticket !== readTicket.current) return;

        live("answered");
        await holdBusy(performance.now(), BEAT.answered.ms);
        if (ticket !== readTicket.current) return;
        finish(found);
        return;
      }

      live("analyzing");
      const analyzeStarted = performance.now();
      const text = await source();
      const found = readCv(text);
      await holdBusy(analyzeStarted, BEAT.analyzing.ms);
      if (ticket !== readTicket.current) return;

      live("answered");
      await holdBusy(performance.now(), BEAT.answered.ms);
      if (ticket !== readTicket.current) return;
      finish(found);
    } catch {
      if (ticket !== readTicket.current) return;
      setStage("idle");
      setError("No se pudo abrir el archivo. Probá con un PDF de texto, un .txt, o pegá el texto.");
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setError("El archivo pesa más de 8 MB. Probá con el CV solo, sin adjuntos.");
      return;
    }

    void runReading(async () => {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        return (await import("../lib/pdf.ts")).extractPdfText(file);
      }
      return file.text();
    }, true);
  };

  const apply = () => {
    const degrees = reading.degrees.filter((id) => kept(`degree:${id}`));
    const courses = reading.courses.filter((id) => kept(`course:${id}`));
    const wanted = reading.categories.filter((slug) => kept(`category:${slug}`));
    const places = reading.places.filter((place) => kept(`place:${place.department}`));

    onApply(
      {
        ...profile,
        degrees: [...new Set([...profile.degrees, ...degrees])],
        courses: [...new Set([...profile.courses, ...courses])],
        education:
          reading.education !== "" && kept("education") ? reading.education : profile.education,
        experienceYears:
          reading.experienceYears !== null && kept("experience")
            ? reading.experienceYears
            : profile.experienceYears,
      },
      {
        ...preferences,
        categories: [...new Set([...preferences.categories, ...wanted])].filter(
          (slug) => !preferences.hiddenCategories.includes(slug),
        ),
        departments: [
          ...new Set([...preferences.departments, ...places.map((p) => p.department)]),
        ].filter((name) => !preferences.hiddenDepartments.includes(name)),
      },
    );

    setStage("idle");
    setReading(EMPTY_READING);
    setPasted("");
  };

  const found =
    reading.degrees.length +
    reading.courses.length +
    reading.categories.length +
    reading.places.length +
    (reading.education === "" ? 0 : 1) +
    (reading.experienceYears === null ? 0 : 1);

  const groups: { key: string; node: React.ReactNode }[] = [];
  if (reading.places.length > 0) {
    groups.push({
      key: "places",
      node: (
        <Group title="Ubicación">
          {reading.places.map((place) => (
            <Pick
              key={place.department}
              checked={kept(`place:${place.department}`)}
              label={place.label}
              onToggle={() => toggle(`place:${place.department}`)}
            />
          ))}
        </Group>
      ),
    });
  }
  if (reading.education !== "") {
    groups.push({
      key: "education",
      node: (
        <Group title="Nivel educativo">
          <Pick
            checked={kept("education")}
            label={EDUCATION_LABEL[reading.education]}
            onToggle={() => toggle("education")}
          />
        </Group>
      ),
    });
  }
  if (reading.degrees.length > 0) {
    groups.push({
      key: "degrees",
      node: (
        <Group title="Títulos">
          {reading.degrees.map((id) => (
            <Pick
              key={id}
              checked={kept(`degree:${id}`)}
              label={labelOf(id)}
              onToggle={() => toggle(`degree:${id}`)}
            />
          ))}
        </Group>
      ),
    });
  }
  if (reading.courses.length > 0) {
    groups.push({
      key: "courses",
      node: (
        <Group title="Cursos y certificaciones">
          {reading.courses.map((id) => (
            <Pick
              key={id}
              checked={kept(`course:${id}`)}
              label={labelOf(id)}
              onToggle={() => toggle(`course:${id}`)}
            />
          ))}
        </Group>
      ),
    });
  }
  if (reading.experienceYears !== null) {
    groups.push({
      key: "experience",
      node: (
        <Group title="Años de experiencia">
          <Pick
            checked={kept("experience")}
            label={
              reading.experienceYears === 0
                ? "Sin experiencia"
                : `${reading.experienceYears} ${reading.experienceYears === 1 ? "año" : "años"}`
            }
            onToggle={() => toggle("experience")}
          />
        </Group>
      ),
    });
  }
  if (reading.categories.length > 0) {
    groups.push({
      key: "categories",
      node: (
        <Group title="Rubros que sugiere">
          {reading.categories.map((slug) => (
            <Pick
              key={slug}
              checked={kept(`category:${slug}`)}
              label={categories.find((facet) => facet.value === slug)?.label ?? slug}
              onToggle={() => toggle(`category:${slug}`)}
            />
          ))}
        </Group>
      ),
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          {title}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-onpanel-muted">
          Leo el archivo <strong>en este navegador</strong> y busco tus títulos, cursos y años de
          experiencia. No se sube a ningún lado. También sirve tu perfil de LinkedIn: entrá a tu
          perfil, “Más” → “Guardar como PDF”, y subí ese archivo.
        </p>
      </div>

      <input ref={input} accept={ACCEPT} className="hidden" type="file" onChange={onFile} />

      {stage === "idle" ? (
        <div className="space-y-2">
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-onpanel-wash px-3 py-2.5 text-xs font-medium text-onpanel/85 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
            type="button"
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden className="size-4" />
            Elegir archivo (PDF o texto)
          </button>

          <details>
            <summary className="cursor-pointer text-[11px] font-medium text-onpanel-muted transition-colors hover:text-onpanel">
              O pegá el texto de tu CV
            </summary>
            <textarea
              className="mt-2 h-28 w-full resize-y rounded-lg border border-onpanel/20 bg-onpanel/5 px-2.5 py-2 text-xs text-onpanel outline-none transition-colors placeholder:text-onpanel-faint focus:border-sky"
              placeholder="Pegá acá tu CV o tu perfil de LinkedIn…"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
            />
            <button
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-onpanel-wash px-2.5 py-1.5 text-[11px] font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel disabled:opacity-40"
              disabled={pasted.trim().length < 20}
              type="button"
              onClick={() => void runReading(async () => pasted, false)}
            >
              <FileUp aria-hidden className="size-3.5" />
              Leer este texto
            </button>
          </details>
        </div>
      ) : null}

      {stage === "uploading" || stage === "analyzing" || stage === "answered" ? (
        <ProgressBeat stage={stage} />
      ) : null}

      {error ? (
        <p className="rounded-lg bg-onpanel-wash px-2.5 py-2 text-[11px] leading-relaxed text-onpanel/70">
          {error}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {stage === "review" ? (
          <motion.div
            ref={reviewRef}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 16 }}
            transition={fadeUpTransition}
          >
            <Aura className={`rounded-xl ${ON_PANEL}`} intro={false}>
              <div className="space-y-4 rounded-xl px-3 py-3">
                <div className="flex items-center gap-2">
                  <AuraSpark intro={false} state="breathing" tone="panel" />
                  <p className="min-w-0 flex-1 text-xs font-semibold text-onpanel">
                    {found === 0 ? "No encontré nada de la lista" : `Encontré ${found} cosas`}
                  </p>
                  <button
                    aria-label="Descartar la lectura"
                    className="shrink-0 rounded-md p-1 text-onpanel-muted transition-colors hover:bg-onpanel/15 hover:text-onpanel"
                    type="button"
                    onClick={() => {
                      setStage("idle");
                      setError(null);
                    }}
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </div>

                {found > 0 ? (
                  <p className="text-[11px] leading-relaxed text-onpanel/80">
                    Tocá para sacar lo que no corresponda. Se suma a tu perfil, no lo reemplaza.
                  </p>
                ) : null}

                {groups.map((group, index) => (
                  <motion.div
                    key={group.key}
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 10 }}
                    transition={{ ...fadeUpTransition, delay: stagger(index, 0.07, 0.4) }}
                  >
                    {group.node}
                  </motion.div>
                ))}

                <div className="space-y-2 border-t border-onpanel/10 pt-3">
                  <motion.button
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-onpanel/20 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_0_20px_color-mix(in_srgb,var(--color-brand)_45%,transparent)] transition-[box-shadow,background-color] hover:bg-green-300/30 hover:shadow-[0_0_28px_color-mix(in_srgb,var(--color-brand)_60%,transparent)] focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-40 disabled:shadow-none"
                    disabled={found === 0}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={apply}
                  >
                    <Plus aria-hidden className="size-3.5" />
                    Sumar a mi perfil
                  </motion.button>
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] text-onpanel-faint">
                    <ShieldCheck aria-hidden className="size-3" />
                    El archivo no salió de tu navegador
                  </span>
                </div>
              </div>
            </Aura>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
