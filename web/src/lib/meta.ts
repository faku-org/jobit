import { formatLocation } from "./format.ts";
import type { Job } from "./types.ts";

/**
 * The head is written once into the built shell and only these few tags move
 * while the app runs. It buys two things: the tab and the browser history read
 * like the offer that is open, and the crawlers that do execute JavaScript see
 * the offer instead of the landing copy. It buys nothing with the scrapers
 * behind WhatsApp, LinkedIn or Slack previews, which read the shell and stop
 * there, so the shell keeps the site-wide title and image as the fallback
 * every shared link falls back to.
 */
const OG_TITLE = 'meta[property="og:title"]';
const DESCRIPTION = 'meta[name="description"]';

const TITLE_TAGS = [OG_TITLE, 'meta[name="twitter:title"]'];

const DESCRIPTION_TAGS = [
  DESCRIPTION,
  'meta[property="og:description"]',
  'meta[name="twitter:description"]',
];

const read = (selector: string): string =>
  document.head.querySelector(selector)?.getAttribute("content") ?? "";

const write = (selectors: string[], content: string): void => {
  for (const selector of selectors) {
    document.head.querySelector(selector)?.setAttribute("content", content);
  }
};

const MAX_DESCRIPTION = 160;

/** Cuts on a word so the snippet never ends mid-word. */
function clamp(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const jobTitle = (job: Job): string =>
  job.company ? `${job.title} · ${job.company}` : `${job.title} · JobIt`;

function jobDescription(job: Job): string {
  const where = formatLocation(job.city, job.department);
  const who = job.company ? ` en ${job.company}` : "";
  const opening = `${job.title}${who}, ${where}.`;
  const body = job.description.replace(/\s+/g, " ").trim();
  return clamp(body ? `${opening} ${body}` : opening, MAX_DESCRIPTION);
}

/**
 * Points the title and the description at one offer and hands back the undo,
 * so closing the sheet leaves the head exactly as the shell shipped it.
 */
export function describeJob(job: Job): () => void {
  const previous = {
    title: document.title,
    heading: read(OG_TITLE),
    description: read(DESCRIPTION),
  };

  document.title = `${job.title} · JobIt`;
  write(TITLE_TAGS, jobTitle(job));
  write(DESCRIPTION_TAGS, jobDescription(job));

  return () => {
    document.title = previous.title;
    write(TITLE_TAGS, previous.heading);
    write(DESCRIPTION_TAGS, previous.description);
  };
}

/**
 * An embed is the same document as the app with one offer in it, so leaving it
 * indexable would put a second, thinner copy of the site in the results. The
 * canonical in the shell already points every query string back at the root;
 * this says the same thing to whatever ignores it.
 */
export function markEmbedNotIndexable(): void {
  document.head.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex, nofollow");
}
