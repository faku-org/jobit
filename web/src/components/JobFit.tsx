import { Check, CircleHelp, Lightbulb, Minus } from "lucide-react";
import { motion } from "motion/react";
import { type CheckStatus, assessFit, educationGap, fitHeadline, hasFit } from "../lib/fit.ts";
import { fadeUpTransition, stagger } from "../lib/motion.ts";
import type { Profile } from "../lib/profile.ts";
import { applyTips } from "../lib/tips.ts";
import type { Job } from "../lib/types.ts";
import { Aura, AuraSpark } from "./Aura.tsx";

interface JobFitProps {
  job: Job;
  profile: Profile;
}

const STATUS_ICON: Record<CheckStatus, typeof Check> = {
  ok: Check,
  short: Minus,
  unknown: CircleHelp,
};

const STATUS_STYLE: Record<CheckStatus, string> = {
  ok: "bg-sky text-ink",
  short: "bg-ink/10 text-ink/60",
  unknown: "bg-mist text-ink/45",
};

const HEADLINE_STYLE: Record<CheckStatus, string> = {
  ok: "border-brand/40 bg-brand/5",
  short: "border-sky/60 bg-mist",
  unknown: "border-sky/50 bg-surface",
};

/**
 * The first thing on the sheet: can you apply to this, and what should you
 * have ready. It sits above the description because that is the order people
 * read in — they decide whether the offer is for them, then read the detail.
 *
 * Nobody wrote any of this: it comes out of the offer measured against the
 * profile, so it wears the same aura as the CV reading.
 */
export function JobFit({ job, profile }: JobFitProps) {
  const fit = assessFit(job, profile);
  const tips = applyTips(job);
  const gap = educationGap(job, profile);

  if (!hasFit(fit) && tips.length === 0) return null;

  return (
    <Aura className="rounded-2xl">
      <section className={`rounded-2xl border px-4 py-3.5 ${HEADLINE_STYLE[fit.status]}`}>
        {hasFit(fit) ? (
          <>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-ink">
              <AuraSpark className="size-3.5 shrink-0 text-brand" />
              {fitHeadline(fit)}
            </h3>

            {fit.unknownProfile ? (
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                Cargá tus estudios y tu experiencia en Perfil y esto pasa a decirte, en cada oferta,
                si llegás a lo que piden.
              </p>
            ) : null}

            <ul className="mt-3 space-y-2">
              {fit.checks.map((check, index) => {
                const Icon = STATUS_ICON[check.status];
                return (
                  <motion.li
                    key={check.id}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5"
                    initial={{ opacity: 0, y: 4 }}
                    transition={{ ...fadeUpTransition, delay: stagger(index) }}
                  >
                    <span
                      className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${STATUS_STYLE[check.status]}`}
                    >
                      <Icon aria-hidden className="size-2.5" />
                    </span>
                    <span className="text-[13px] leading-snug text-ink/80">
                      {check.asks}
                      {check.yours ? <span className="text-ink/45"> · {check.yours}</span> : null}
                    </span>
                  </motion.li>
                );
              })}
            </ul>

            {fit.matched.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fit.matched.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-1 text-xs font-medium text-ink"
                    title="Lo pide y lo tenés en tu perfil"
                  >
                    <Check aria-hidden className="size-3" />
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            {gap ? <p className="mt-3 text-xs leading-relaxed text-ink/55">{gap}</p> : null}
          </>
        ) : null}

        {tips.length > 0 ? (
          <div className={hasFit(fit) ? "mt-4 border-t border-ink/10 pt-3" : ""}>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink/55 uppercase">
              <Lightbulb aria-hidden className="size-3.5 text-brand" />
              Antes de postularte
            </p>
            <ul className="mt-2 space-y-1.5">
              {tips.map((tip, index) => (
                <motion.li
                  key={tip}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5 text-[13px] leading-relaxed text-ink/75"
                  initial={{ opacity: 0, y: 4 }}
                  transition={{ ...fadeUpTransition, delay: stagger(index) }}
                >
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  {tip}
                </motion.li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </Aura>
  );
}
