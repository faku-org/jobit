import { JOB_TYPE_LABEL, relativeDate } from "./format.ts";
import type { Job } from "./types.ts";

const DAY_MS = 86_400_000;
const MAX_TIPS = 5;
const MIN_TIPS = 3;

/** Used only to round out an offer that says little about itself. */
const GENERIC_TIPS = [
  "Mandá el CV en PDF, con el nombre del puesto y el tuyo en el asunto.",
  "Sumá dos o tres líneas contando por qué te interesa: casi nadie las escribe.",
];

const daysSince = (iso: string, now: number): number | null => {
  const posted = Date.parse(iso);
  return Number.isNaN(posted) ? null : Math.floor((now - posted) / DAY_MS);
};

/**
 * Advice for this offer in particular, in priority order and capped, so the
 * modal never turns into a wall of generic career tips.
 */
export function applyTips(job: Job, now: number = Date.now()): string[] {
  const tips: string[] = [];
  const age = daysSince(job.date_posted, now);

  if (job.no_experience) {
    tips.push(
      "No piden experiencia previa: contá estudios, cursos y trabajos informales, alcanza para entrar.",
    );
  } else if (job.experience_years_min !== null) {
    const years = job.experience_years_min;
    tips.push(
      `Piden ${years} ${years === 1 ? "año" : "años"} de experiencia. Si te falta poco, postulate igual y contá lo más parecido que hiciste.`,
    );
  }

  if (job.requirements) {
    tips.push(
      "Repetí en tu CV las mismas palabras que usan en los requisitos: muchos filtros buscan texto exacto.",
    );
  }

  if (age !== null && age <= 2) {
    tips.push("Se publicó recién. Postularte hoy te deja entre los primeros currículums.");
  } else if (age !== null && age >= 21) {
    tips.push(
      `La oferta es de ${relativeDate(job.date_posted, now)}: puede estar cubierta, no te desanimes si no contestan.`,
    );
  }

  if (job.remote) {
    tips.push(
      job.remote === "remote"
        ? "Es remoto: aclará tu disponibilidad horaria y que tenés equipo e internet estable."
        : "Es híbrido: confirmá que podés ir a la oficina los días que pidan.",
    );
  }

  if (job.schedule) {
    tips.push(`El horario es ${job.schedule}. Chequeá que te sirva antes de mandar el CV.`);
  }

  if (job.salary) {
    tips.push("Publican el sueldo: si te preguntan pretensiones, no pidas menos de ese rango.");
  } else if (job.job_type) {
    tips.push(
      `No publican sueldo para esta ${JOB_TYPE_LABEL[job.job_type].toLowerCase()}: llevá una pretensión pensada por las dudas.`,
    );
  }

  if (job.vacancies !== null && job.vacancies > 1) {
    tips.push(`Hay ${job.vacancies} vacantes, así que suelen responder más rápido.`);
  }

  if (job.duplicates.length > 0) {
    tips.push("La misma búsqueda está publicada en otro portal: postulate una sola vez.");
  }

  if (!job.company) {
    tips.push("El aviso no dice la empresa: averiguá quién publica antes de dar datos personales.");
  }

  for (const tip of GENERIC_TIPS) {
    if (tips.length >= MIN_TIPS) break;
    tips.push(tip);
  }

  return tips.slice(0, MAX_TIPS);
}
