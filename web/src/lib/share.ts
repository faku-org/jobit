import { formatLocation } from "./format.ts";
import { type Service, serviceLocation } from "./services.ts";
import type { Job, Theme } from "./types.ts";

/** Where the app is served from, so a shared link survives any deploy path. */
const base = (): string => {
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/index\.html$/, "");
};

/** The link that reopens this offer inside the app. */
export const jobLink = (id: string): string => `${base()}?job=${encodeURIComponent(id)}`;

/** The link a host page loads inside an iframe: one offer, no app around it. */
export const embedLink = (id: string): string => `${base()}?embed=${encodeURIComponent(id)}`;

export const shareTitle = (job: Job): string =>
  job.company ? `${job.title} · ${job.company}` : job.title;

export const shareText = (job: Job): string =>
  `${shareTitle(job)} · ${formatLocation(job.city, job.department)}`;

export const whatsappLink = (job: Job): string =>
  `https://wa.me/?text=${encodeURIComponent(`${shareText(job)}\n${jobLink(job.id)}`)}`;

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The iframe snippet the person pastes into their own site. */
export const embedSnippet = (job: Job): string => iframe(embedLink(job.id), shareTitle(job), 220);

/** El enlace que reabre este servicio dentro de la app. */
export const serviceLink = (slug: string): string =>
  `${base()}?service=${encodeURIComponent(slug)}`;

/** El servicio solo, para el iframe de otra página. */
export const embedServiceLink = (slug: string): string =>
  `${base()}?embed_service=${encodeURIComponent(slug)}`;

/**
 * Lo que se comparte, ya armado por quien lo comparte. El menú es uno solo
 * para las dos secciones: lo que cambia entre una oferta y un servicio es el
 * texto y los enlaces, no la forma de pasarlos.
 */
export interface ShareTarget {
  title: string;
  text: string;
  url: string;
  /** El iframe para pegar en otra página. */
  embed: string;
  whatsapp: string;
  /** Qué se está compartiendo, para el lector de pantalla. */
  label: string;
}

const whatsapp = (text: string, url: string): string =>
  `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;

const iframe = (src: string, title: string, height: number): string =>
  `<iframe src="${escapeAttribute(src)}" title="${escapeAttribute(title)}" width="100%" height="${height}" loading="lazy" style="border:0;max-width:560px"></iframe>`;

export const jobShare = (job: Job): ShareTarget => ({
  title: shareTitle(job),
  text: shareText(job),
  url: jobLink(job.id),
  embed: embedSnippet(job),
  whatsapp: whatsappLink(job),
  label: "Compartir oferta",
});

export function serviceShare(service: Service): ShareTarget {
  const title = `${service.title} · ${service.owner_name}`;
  const text = `${title} · ${serviceLocation(service)}`;
  const url = serviceLink(service.slug);

  return {
    title,
    text,
    url,
    embed: iframe(embedServiceLink(service.slug), title, 240),
    whatsapp: whatsapp(text, url),
    label: "Compartir servicio",
  };
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

export const canShare = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

/** Hands the offer to the system share sheet where there is one. */
export async function share(target: ShareTarget): Promise<ShareResult> {
  if (!canShare()) return "unsupported";
  try {
    await navigator.share({ title: target.title, text: target.text, url: target.url });
    return "shared";
  } catch {
    return "cancelled";
  }
}

/** Falls back to a hidden textarea where the clipboard API is not allowed. */
function legacyCopy(value: string): boolean {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return legacyCopy(value);
  }
}

/** The offer a shared link points at, if the address bar carries one. */
export const sharedJobId = (search: string = window.location.search): string | null =>
  new URLSearchParams(search).get("job");

/** Writes the open offer into the address bar without touching the history. */
export function setSharedJobId(id: string | null): void {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("job", id);
  else url.searchParams.delete("job");
  window.history.replaceState(null, "", url);
}

/** El servicio que abre un enlace compartido, si la barra trae uno. */
export const sharedServiceSlug = (search: string = window.location.search): string | null =>
  new URLSearchParams(search).get("service");

/** Escribe el servicio abierto en la barra sin tocar el historial. */
export function setSharedServiceSlug(slug: string | null): void {
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set("service", slug);
  else url.searchParams.delete("service");
  window.history.replaceState(null, "", url);
}

export interface EmbedRequest {
  id: string;
  /** The host page can pin the scheme with `&theme=dark`. */
  theme: Theme;
}

const THEMES: Theme[] = ["light", "dark", "system"];

const themeOf = (params: URLSearchParams): Theme =>
  THEMES.find((value) => value === params.get("theme")) ?? "system";

/** Reads the embed parameters; null means the normal app should render. */
export function embedRequest(search: string = window.location.search): EmbedRequest | null {
  const params = new URLSearchParams(search);
  const id = params.get("embed");
  if (!id) return null;

  return { id, theme: themeOf(params) };
}

export interface ServiceEmbedRequest {
  slug: string;
  theme: Theme;
}

/** Lo mismo para un servicio: `?embed_service=<slug>` y el mismo `&theme=`. */
export function embedServiceRequest(
  search: string = window.location.search,
): ServiceEmbedRequest | null {
  const params = new URLSearchParams(search);
  const slug = params.get("embed_service");
  if (!slug) return null;

  return { slug, theme: themeOf(params) };
}
