import { type EmployerProfile, employerFacets, employerSlug } from "./employers.ts";
import { type PageMeta, type SitemapEntry, escapeHtml, layout, publicOrigin } from "./pages.ts";
import type { Job } from "./types.ts";

/**
 * `/empresa/<slug>`: el stand de una empresa como página que un buscador lee.
 * Sale de las mismas ofertas que el stand de la app (`employerProfile`), sin
 * tabla ni dato nuevo; lo único que se suma es el sitio web cuando la empresa
 * tiene cuenta aprobada, y nada más se inventa.
 */

const MODE_LABEL: Record<string, string> = {
  onsite: "Presencial",
  remote: "Remoto",
  hybrid: "Híbrido",
};

/** Cuántas ofertas lista la página; el resto está en la app. */
const LISTED = 50;

/** Con una sola oferta la página es un duplicado de la ficha de esa oferta:
 * no se anuncia en el sitemap, aunque la dirección siga respondiendo. */
export const MIN_SITEMAP_OFFERS = 2;

export const employerPath = (slug: string): string => `/empresa/${encodeURIComponent(slug)}`;

const pesos = (value: number): string => `$ ${new Intl.NumberFormat("es-UY").format(value)}`;

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

/** Un sitio web solo entra si es http(s): se guarda validado, pero es lo que
 * termina en `href` y en JSON-LD, así que se vuelve a mirar. */
export function safeWebsite(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * La empresa como `Organization`. Es una organización mencionada, no propia:
 * solo lleva el nombre y, si existe, su sitio. Nada de logo, dirección ni
 * cantidad de empleados, que el tablero no sabe.
 */
export function employerLd(label: string, website: string | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: label,
    ...(website ? { url: website } : {}),
  };
}

const chip = (text: string): string => `<span class="chip">${escapeHtml(text)}</span>`;

function offerItem(job: Job): string {
  const where = [job.city, job.department].filter(Boolean).join(", ") || "Uruguay";
  const day = job.date_posted.slice(0, 10);
  return `<li><a href="${escapeHtml(publicOrigin())}/empleo/${encodeURIComponent(job.id)}">${escapeHtml(job.title)}</a><div class="where">${escapeHtml(where)}${day ? ` · ${escapeHtml(day)}` : ""}</div></li>`;
}

export function employerPageHtml(
  profile: EmployerProfile,
  jobs: Job[],
  website: string | null | undefined = null,
): string {
  const { label, count } = profile;
  const topRoles = profile.roles.slice(0, 5).map((role) => role.label);
  const place = profile.departments.slice(0, 3).map((entry) => entry.value);

  const description = [
    `${label} tiene ${count} ${plural(count, "oferta publicada", "ofertas publicadas")} en JobIt.`,
    topRoles.length > 0 ? `Puestos más buscados: ${topRoles.join(", ")}.` : "",
    place.length > 0 ? `Ubicación: ${place.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);

  const meta: PageMeta = {
    title: `Trabajar en ${label}: ofertas y sueldos · JobIt`,
    description,
    path: employerPath(profile.value),
    jsonLd: employerLd(label, safeWebsite(website)),
  };

  const salary = profile.salary;
  const modes = profile.modes
    .map((mode) => `${MODE_LABEL[mode.value] ?? mode.value} (${mode.count})`)
    .join(", ");
  const facts = [
    `<tr><td>Ofertas publicadas</td><td>${count}</td></tr>`,
    place.length > 0
      ? `<tr><td>Departamentos</td><td>${escapeHtml(
          profile.departments.map((entry) => `${entry.value} (${entry.count})`).join(", "),
        )}</td></tr>`
      : "",
    modes ? `<tr><td>Modalidad</td><td>${escapeHtml(modes)}</td></tr>` : "",
    salary
      ? `<tr><td>Sueldo mensual publicado (mediana)</td><td>${escapeHtml(pesos(salary.median))} <span class="muted">· de ${escapeHtml(pesos(salary.min))} a ${escapeHtml(pesos(salary.max))}, según ${salary.count} ${plural(salary.count, "aviso", "avisos")}</span></td></tr>`
      : "",
  ].join("");

  const websiteLink = safeWebsite(website);
  const listed = jobs.slice(0, LISTED);
  const appLink = `${escapeHtml(publicOrigin())}/?company=${encodeURIComponent(profile.value)}`;

  const body = `
<article>
<h1>Trabajar en ${escapeHtml(label)}</h1>
<p>${escapeHtml(label)} tiene <strong>${count}</strong> ${plural(count, "oferta publicada", "ofertas publicadas")} en JobIt${profile.noExperience > 0 ? `, ${profile.noExperience} sin pedir experiencia` : ""}.</p>
${profile.categories.length > 0 ? `<div class="chips">${profile.categories.map((entry) => chip(`${entry.label} · ${entry.count}`)).join("")}</div>` : ""}
<a class="cta" href="${appLink}">Ver sus ofertas en JobIt</a>
${websiteLink ? `<a class="cta ghost" href="${escapeHtml(websiteLink)}" rel="noopener nofollow" target="_blank">Sitio de ${escapeHtml(label)}</a>` : ""}
<h2>Resumen</h2>
<table><tbody>${facts}</tbody></table>
${
  profile.roles.length > 0
    ? `<h2>Puestos más buscados</h2><table><tbody>${profile.roles
        .map((role) => `<tr><td>${escapeHtml(role.label)}</td><td>${role.count}</td></tr>`)
        .join("")}</tbody></table>`
    : ""
}
<h2>Ofertas de ${escapeHtml(label)}</h2>
<ul class="jobs">${listed.map(offerItem).join("")}</ul>
<p class="muted">${jobs.length} ${plural(jobs.length, "oferta", "ofertas")}${jobs.length > LISTED ? ` (mostrando las ${LISTED} más recientes)` : ""}.</p>
</article>
<p class="muted">Es lo que JobIt ve en sus ofertas: no hay datos de empleados ni de la empresa por fuera de los avisos publicados.</p>`;

  return layout(meta, body);
}

/** Una entrada por empresa con al menos `MIN_SITEMAP_OFFERS` ofertas. */
export function employerSitemapEntries(jobs: Job[]): SitemapEntry[] {
  return employerFacets(jobs, undefined, Number.POSITIVE_INFINITY)
    .filter((facet) => facet.count >= MIN_SITEMAP_OFFERS)
    .map((facet) => ({
      path: employerPath(facet.value),
      changefreq: "weekly" as const,
      priority: 0.4,
    }));
}

/** Compara el slug de una cuenta con el de un aviso: mismo criterio que el
 * agrupado de empresas, no el `slugify` de la cuenta (que difiere en siglas). */
export const sameEmployerName = (account: string, slug: string): boolean =>
  employerSlug(account) === slug;
