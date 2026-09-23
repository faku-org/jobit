/**
 * Cómo se dicen en español los valores cerrados que guarda una oferta.
 *
 * Viven acá y no en la web porque hay dos lugares que los necesitan: la
 * interfaz, y la exportación del mercado, que se arma en la API. Un mapa por
 * paquete se desincroniza el día que se suma una fuente o un nivel.
 */
import type { JobType, Level, Remote } from "./types.ts";

export const LEVEL_LABEL: Record<Level, string> = {
  entry: "Junior",
  mid: "Semi senior",
  senior: "Senior",
};

export const WORK_MODE_LABEL: Record<Remote | "onsite", string> = {
  onsite: "Presencial",
  remote: "Remoto",
  hybrid: "Híbrido",
};

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  full_time: "Jornada completa",
  part_time: "Medio horario",
  internship: "Pasantía",
};

/** `jobit` no es una fuente scrapeada sino las ofertas propias, y una fuente
 * nueva puede aparecer en un archivo viejo: la clave queda abierta y quien
 * consulta cae en el valor crudo si no está. */
export const SOURCE_LABEL: Record<string, string> = {
  jobit: "JobIt",
  buscojobs: "BuscoJobs",
  gallito: "Gallito",
  uruguayconcursa: "Uruguay Concursa",
};
