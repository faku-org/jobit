import { Check, FileUp, Loader2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ChangeEvent, useRef, useState } from "react";
import { COURSES, DEGREES } from "../lib/catalog.ts";
import { type CvReading, EMPTY_READING, isEmptyReading, readCv } from "../lib/cv.ts";
import { fadeUpTransition } from "../lib/motion.ts";
import { EDUCATION_LABEL, type Profile } from "../lib/profile.ts";
import type { Facet, Preferences } from "../lib/types.ts";

interface CvImportProps {
  profile: Profile;
  preferences: Preferences;
  categories: Facet[];
  onApply: (profile: Profile, preferences: Preferences) => void;
  /** What the block calls itself, so the onboarding can offer it as a shortcut
   * rather than as one more field of the profile. */
  title?: string;
  /** Where a reading that recognised nothing goes. The panel says so and lets
   * the person try another file; the onboarding has somewhere better to send
   * them, so it takes over instead of leaving a dead end on the first screen. */
  onEmpty?: () => void;
}

/** Bigger than this is not a CV, and reading it would lock the tab. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPT = ".pdf,.txt,.md,.markdown,text/plain,application/pdf";

type Stage = "idle" | "reading" | "review";

const labelOf = (id: string): string =>
  [...DEGREES, ...COURSES].find((entry) => entry.id === id)?.label ?? id;

/** One found item, with the switch that decides whether it is kept. */
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
        checked ? "bg-sky text-ink" : "bg-onpanel/10 text-onpanel/50 hover:bg-onpanel/20"
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
      <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Reads a CV — or a LinkedIn profile saved as PDF — and matches it against the
 * same closed lists the profile uses. The file is opened in this browser and
 * nothing is uploaded; there is no server that could receive it.
 *
 * Nothing is applied without being shown first: the reading is a proposal with
 * every item switchable, because a wrong guess about somebody's studies is
 * worse than no guess at all.
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

  const kept = (key: string) => !dropped.has(key);
  const toggle = (key: string) =>
    setDropped((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const present = (text: string) => {
    const found = readCv(text);

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

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setError("El archivo pesa más de 8 MB. Probá con el CV solo, sin adjuntos.");
      return;
    }

    setStage("reading");
    setError(null);

    try {
      const text =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
          ? await (await import("../lib/pdf.ts")).extractPdfText(file)
          : await file.text();
      present(text);
    } catch {
      setStage("idle");
      setError("No se pudo abrir el archivo. Probá con un PDF de texto, un .txt, o pegá el texto.");
    }
  };

  const apply = () => {
    const degrees = reading.degrees.filter((id) => kept(`degree:${id}`));
    const courses = reading.courses.filter((id) => kept(`course:${id}`));
    const wanted = reading.categories.filter((slug) => kept(`category:${slug}`));

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
    (reading.education === "" ? 0 : 1) +
    (reading.experienceYears === null ? 0 : 1);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-onpanel/50">
          Leo el archivo <strong>en este navegador</strong> y busco tus títulos, cursos y años de
          experiencia. No se sube a ningún lado. También sirve tu perfil de LinkedIn: entrá a tu
          perfil, “Más” → “Guardar como PDF”, y subí ese archivo.
        </p>
      </div>

      <input
        ref={input}
        accept={ACCEPT}
        className="hidden"
        type="file"
        onChange={(event) => void onFile(event)}
      />

      {stage !== "review" ? (
        <div className="space-y-2">
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-onpanel/10 px-3 py-2.5 text-xs font-medium text-onpanel/85 transition-colors hover:bg-onpanel/20 hover:text-onpanel disabled:opacity-60"
            disabled={stage === "reading"}
            type="button"
            onClick={() => input.current?.click()}
          >
            {stage === "reading" ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Upload aria-hidden className="size-4" />
            )}
            {stage === "reading" ? "Leyendo el archivo…" : "Elegir archivo (PDF o texto)"}
          </button>

          <details>
            <summary className="cursor-pointer text-[11px] font-medium text-onpanel/50 transition-colors hover:text-onpanel">
              O pegá el texto de tu CV
            </summary>
            <textarea
              className="mt-2 h-28 w-full resize-y rounded-lg border border-onpanel/20 bg-onpanel/5 px-2.5 py-2 text-xs text-onpanel outline-none transition-colors placeholder:text-onpanel/40 focus:border-sky"
              placeholder="Pegá acá tu CV o tu perfil de LinkedIn…"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
            />
            <button
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-onpanel/10 px-2.5 py-1.5 text-[11px] font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel disabled:opacity-40"
              disabled={pasted.trim().length < 20}
              type="button"
              onClick={() => present(pasted)}
            >
              <FileUp aria-hidden className="size-3.5" />
              Leer este texto
            </button>
          </details>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-onpanel/10 px-2.5 py-2 text-[11px] leading-relaxed text-onpanel/70">
          {error}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {stage === "review" ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={fadeUpTransition}
          >
            <div className="space-y-4 rounded-xl bg-onpanel/10 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-onpanel">
                  <Sparkles aria-hidden className="size-3.5 text-sky" />
                  {found === 0 ? "No encontré nada de la lista" : `Encontré ${found} cosas`}
                </p>
                <button
                  aria-label="Descartar la lectura"
                  className="shrink-0 rounded-md p-1 text-onpanel/50 transition-colors hover:bg-onpanel/15 hover:text-onpanel"
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
                <p className="text-[11px] leading-relaxed text-onpanel/60">
                  Tocá para sacar lo que no corresponda. Se suma a tu perfil, no lo reemplaza.
                </p>
              ) : null}

              {reading.education !== "" ? (
                <Group title="Nivel educativo">
                  <Pick
                    checked={kept("education")}
                    label={EDUCATION_LABEL[reading.education]}
                    onToggle={() => toggle("education")}
                  />
                </Group>
              ) : null}

              {reading.degrees.length > 0 ? (
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
              ) : null}

              {reading.courses.length > 0 ? (
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
              ) : null}

              {reading.experienceYears !== null ? (
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
              ) : null}

              {reading.categories.length > 0 ? (
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
              ) : null}

              <div className="flex items-center gap-2 border-t border-onpanel/10 pt-3">
                <button
                  className="rounded-lg bg-sky px-3 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:bg-sky/85 disabled:opacity-40"
                  disabled={found === 0}
                  type="button"
                  onClick={apply}
                >
                  Sumar a mi perfil
                </button>
                <span className="inline-flex items-center gap-1 text-[10px] text-onpanel/45">
                  <ShieldCheck aria-hidden className="size-3" />
                  El archivo no salió de tu navegador
                </span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
