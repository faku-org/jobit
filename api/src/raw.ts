import type { Job, JobsResponse } from "./types.ts";

/**
 * Una oferta en texto, para leerla o grepearla sin la interfaz.
 *
 * Tres líneas fijas: el puesto, dónde, el enlace. El detalle (una sola oferta)
 * agrega la descripción debajo, porque en un listado de cincuenta no se puede
 * leer y en `curl /api/jobs/:id` sí.
 */
export function formatJob(job: Job, detail = false): string {
  const where = [job.company, job.city ?? job.department, job.category_label].filter(
    (part): part is string => part !== null && part !== "",
  );
  const lines = [job.title, where.join(" · "), job.apply_url];
  if (detail) {
    const body = job.description.trim();
    if (body !== "") lines.push("", body);
  }
  return lines.join("\n");
}

/** El listado entero, con un encabezado que dice qué rebanada se está viendo. */
export function formatJobs(response: JobsResponse): string {
  const from = response.jobs.length === 0 ? 0 : response.offset + 1;
  const to = response.offset + response.jobs.length;
  const header = `JobIt ${from}-${to} de ${response.total}`;
  if (response.jobs.length === 0) return `${header}\n`;
  return `${header}\n\n${response.jobs.map((job) => formatJob(job)).join("\n\n")}\n`;
}
