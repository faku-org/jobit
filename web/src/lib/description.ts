/**
 * Job boards hand over one long string. Inside it there is real structure —
 * "REQUISITOS:", a list of bullets, "Organismo: Facultad de Veterinaria" — and
 * rendering it as a single pre-wrapped paragraph throws all of it away. This
 * reads the shape back out so the sheet can show headings as headings and
 * lists as lists.
 */
export type Block =
  | { kind: "heading"; text: string }
  | { kind: "fields"; rows: { label: string; value: string }[] }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

const BULLET = /^\s*[-–—•*·▪●]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/** "Organismo: Facultad de Veterinaria": a short label, then its value. */
const FIELD = /^([A-Za-zÁÉÍÓÚÑÜáéíóúñü][\wÁÉÍÓÚÑÜáéíóúñü ()/.-]{2,32}):[ \t]*(.+)$/;

/** The same shape with nothing after the colon is a heading: "REQUISITOS:". */
const HEADING_COLON = /^([A-Za-zÁÉÍÓÚÑÜáéíóúñü][\wÁÉÍÓÚÑÜáéíóúñü ¿?()/.,-]{2,48}):[ \t]*$/;

const MAX_HEADING_LENGTH = 48;

/**
 * Emoji that did not survive the job board's own encoding: an employer typed
 * "🚀 ¿Cuál será tu desafío?" and what arrives is "???? ¿Cuál…". A run of bare
 * question marks with a space after it was a pictogram, never punctuation.
 */
const LOST_EMOJI = /(^|\s)[?\uFFFD]{2,}(?=\s|$)/gu;

const clean = (line: string): string => line.replace(LOST_EMOJI, "$1").trim();

const isUpperCase = (line: string): boolean =>
  line === line.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(line);

/**
 * A line is a heading when it announces what follows rather than saying it:
 * short, no sentence punctuation, and either shouted, ending in a colon, or
 * asking the question the next paragraph answers.
 */
function isHeading(line: string): boolean {
  if (line.length > MAX_HEADING_LENGTH) return false;
  if (HEADING_COLON.test(line)) return true;
  if (line.endsWith("?") && line.length > 4) return true;
  return isUpperCase(line) && !line.includes(",") && !line.endsWith(".");
}

const stripHeading = (line: string): string => line.replace(/:\s*$/, "").trim();

/** Bullets written as "-" or "1." both mean the same thing here. */
function bulletText(line: string): string | null {
  const match = BULLET.exec(line) ?? NUMBERED.exec(line);
  return match?.[1]?.trim() ?? null;
}

export function parseDescription(text: string): Block[] {
  const blocks: Block[] = [];
  /** The paragraph and list being built: consecutive lines join into one. */
  let paragraph: string[] = [];
  let items: string[] = [];
  let rows: { label: string; value: string }[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (items.length > 0) blocks.push({ kind: "list", items });
    items = [];
  };
  const flushFields = () => {
    if (rows.length > 0) blocks.push({ kind: "fields", rows });
    rows = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushFields();
  };

  for (const raw of text.split("\n")) {
    const line = clean(raw);

    if (line === "") {
      flushAll();
      continue;
    }

    const bullet = bulletText(line);
    if (bullet !== null) {
      flushParagraph();
      flushFields();
      if (bullet) items.push(bullet);
      continue;
    }

    if (isHeading(line)) {
      flushAll();
      blocks.push({ kind: "heading", text: stripHeading(line) });
      continue;
    }

    /** "https://…" fits the label-colon-value shape and is not a field. */
    const field = /^\w+:\/\//.test(line) ? null : FIELD.exec(line);
    if (field?.[1] && field[2]) {
      flushParagraph();
      flushList();
      rows.push({ label: field[1].trim(), value: field[2].trim() });
      continue;
    }

    flushList();
    flushFields();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

/** A run of text with the meaning the renderer needs to give it. */
export type Span =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "mark"; text: string; note: string; tone: "perk" | "match" };

/** Boards leave markdown emphasis, bare URLs and e-mails inside the text. */
const INLINE = /(\*[^*\n]+\*)|(https?:\/\/[^\s<>()]+)|([\w.+-]+@[\w-]+\.[\w.]+[\w])/g;

function inlineSpans(text: string): Span[] {
  const spans: Span[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const at = match.index;
    if (at > last) spans.push({ kind: "text", text: text.slice(last, at) });

    const [whole, emphasis, url, email] = match;
    if (emphasis) spans.push({ kind: "strong", text: emphasis.slice(1, -1) });
    else if (url) spans.push({ kind: "link", text: url, href: url });
    else if (email) spans.push({ kind: "link", text: email, href: `mailto:${email}` });

    last = at + whole.length;
  }

  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) });
  return spans;
}

/** What a highlighter found in the text, with where and why. */
export interface Mark {
  start: number;
  end: number;
  note: string;
  tone: "perk" | "match";
}

/** Splits plain text around the marks, leaving the rest of it alone. */
function markSpans(text: string, offset: number, marks: Mark[]): Span[] {
  const inside = marks
    .filter((mark) => mark.start >= offset && mark.end <= offset + text.length)
    .sort((a, b) => a.start - b.start);

  const spans: Span[] = [];
  let last = 0;

  for (const mark of inside) {
    const start = mark.start - offset;
    const end = mark.end - offset;
    if (start < last) continue;
    if (start > last) spans.push({ kind: "text", text: text.slice(last, start) });
    spans.push({ kind: "mark", text: text.slice(start, end), note: mark.note, tone: mark.tone });
    last = end;
  }

  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) });
  return spans;
}

/**
 * Emphasis, links and highlights in one pass. Marks are offsets into the same
 * string that is passed here — one block's text, never the whole description —
 * and they are applied only to the runs that stayed plain, so a highlight can
 * never cut a URL in half.
 */
export function renderSpans(text: string, marks: Mark[] = []): Span[] {
  if (marks.length === 0) return inlineSpans(text);

  const spans: Span[] = [];
  let offset = 0;

  for (const span of inlineSpans(text)) {
    if (span.kind === "text") spans.push(...markSpans(span.text, offset, marks));
    else spans.push(span);
    offset += span.kind === "strong" ? span.text.length + 2 : span.text.length;
  }

  return spans;
}
