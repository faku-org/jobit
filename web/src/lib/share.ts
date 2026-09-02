import { formatLocation } from "./format.ts";
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
export const embedSnippet = (job: Job): string =>
  `<iframe src="${escapeAttribute(embedLink(job.id))}" title="${escapeAttribute(shareTitle(job))}" width="100%" height="220" loading="lazy" style="border:0;max-width:560px"></iframe>`;

export type ShareResult = "shared" | "cancelled" | "unsupported";

export const canShare = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

/** Hands the offer to the system share sheet where there is one. */
export async function shareJob(job: Job): Promise<ShareResult> {
  if (!canShare()) return "unsupported";
  try {
    await navigator.share({ title: shareTitle(job), text: shareText(job), url: jobLink(job.id) });
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

export interface EmbedRequest {
  id: string;
  /** The host page can pin the scheme with `&theme=dark`. */
  theme: Theme;
}

const THEMES: Theme[] = ["light", "dark", "system"];

/** Reads the embed parameters; null means the normal app should render. */
export function embedRequest(search: string = window.location.search): EmbedRequest | null {
  const params = new URLSearchParams(search);
  const id = params.get("embed");
  if (!id) return null;

  const theme = params.get("theme");
  return { id, theme: THEMES.find((value) => value === theme) ?? "system" };
}
