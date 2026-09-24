import { CATEGORIES } from "@jobit/worker/categories";
import { roleOf } from "@jobit/worker/roles";
import { sha256 } from "./auth.ts";

/**
 * Moderación previa: nada se ve hasta que alguien lo aprueba. Con una sola
 * persona administrando, lo que importa es que la cola llegue ordenada.
 *
 * El filtro corre acá. Mandar la descripción que escribió alguien a una API de
 * terceros para que la clasifique contradice la Zero Data Policy entera; si
 * algún día se usa un modelo externo va con BYOK, apagado por defecto y dicho
 * en la política.
 *
 * La salida es un puntaje de 0 a 100 con los motivos que lo explican, y el
 * puntaje **ordena** la cola. Rechazo automático solo para lo inequívoco: un
 * clasificador que borra solo es un clasificador que un día borra el servicio
 * de alguien que hizo todo bien.
 */
export interface Signal {
  code: string;
  weight: number;
  detail: string;
}

export interface Review {
  score: number;
  reasons: Signal[];
  /** `queue` es lo normal: alguien lo mira. `reject` es solo lo inequívoco. */
  decision: "queue" | "reject";
}

export interface ServiceText {
  title: string;
  summary: string;
  description: string;
  category: string;
  skills: string[];
}

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const words = (value: string): string[] =>
  fold(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const bodyOf = (text: ServiceText): string =>
  [text.title, text.summary, text.description, text.skills.join(" ")].join("\n");

/**
 * El contacto va en su campo y no adentro del texto: ahí no se puede moderar,
 * no se puede ocultar y termina indexado.
 */
const PHONE = /(?:\+?598|0)?\s?(?:9\d{2}|\d{2})[\s.-]?\d{3}[\s.-]?\d{3}/;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;

/** Lo que sí tiene sentido enlazar desde un servicio: trabajo mostrado. */
const ALLOWED_HOSTS = new Set([
  "linkedin.com",
  "github.com",
  "behance.net",
  "dribbble.com",
  "instagram.com",
]);

const hostOf = (raw: string): string => {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const MIN_DESCRIPTION = 120;
const SHOUT_MIN_LENGTH = 40;
const SHOUT_RATIO = 0.6;

/** Frases que se repiten tal cual: el relleno que llena un campo sin decir nada. */
function repeatedPhrase(value: string): string {
  const phrases = fold(value)
    .split(/[.\n!?]+/)
    .map((phrase) => phrase.replace(/\s+/g, " ").trim())
    .filter((phrase) => phrase.length > 15);

  const seen = new Set<string>();
  for (const phrase of phrases) {
    if (seen.has(phrase)) return phrase;
    seen.add(phrase);
  }
  return "";
}

/** Primera capa, la barata: lo que se ve sin comparar contra nada. */
export function heuristics(text: ServiceText): Signal[] {
  const signals: Signal[] = [];
  const body = bodyOf(text);

  const links = body.match(/https?:\/\/\S+/gi) ?? [];
  const foreign = links.map(hostOf).filter((host) => host && !ALLOWED_HOSTS.has(host));
  if (foreign.length > 0) {
    signals.push({ code: "enlace", weight: 20, detail: foreign.slice(0, 3).join(", ") });
  }

  if (PHONE.test(body)) {
    signals.push({ code: "telefono", weight: 25, detail: "hay un teléfono en el texto" });
  }
  if (EMAIL.test(body)) {
    signals.push({ code: "correo", weight: 25, detail: "hay un correo en el texto" });
  }

  const letters = [...text.description].filter((char) => /[a-záéíóúñ]/i.test(char));
  const upper = letters.filter((char) => char === char.toUpperCase());
  if (letters.length > SHOUT_MIN_LENGTH && upper.length / letters.length > SHOUT_RATIO) {
    signals.push({ code: "mayusculas", weight: 15, detail: "casi todo en mayúsculas" });
  }

  const repeated = repeatedPhrase(text.description);
  if (repeated) {
    signals.push({ code: "repeticion", weight: 15, detail: repeated.slice(0, 60) });
  }

  if (text.description.trim().length < MIN_DESCRIPTION) {
    signals.push({ code: "corto", weight: 10, detail: "la descripción casi no dice nada" });
  }

  if (text.skills.length === 0) {
    signals.push({ code: "sin-habilidades", weight: 10, detail: "no declaró habilidades" });
  }

  return signals;
}

const SHINGLE_WORDS = 3;

/** Ventanas de tres palabras: lo que sobrevive a cambiar dos frases de lugar. */
export function shingles(value: string): string[] {
  const list = words(value);
  if (list.length < SHINGLE_WORDS) return list.length > 0 ? [list.join(" ")] : [];

  const out: string[] = [];
  for (let index = 0; index + SHINGLE_WORDS <= list.length; index++) {
    out.push(list.slice(index, index + SHINGLE_WORDS).join(" "));
  }
  return out;
}

const HASHES = 128;

/** FNV-1a, que alcanza y sobra para firmar shingles. */
function hash32(value: string, seed: number): number {
  let hash = 2_166_136_261 ^ seed;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * La firma MinHash de un texto. Es lo único que se guarda para reconocer que
 * el mismo contenido volvió: no se puede volver atrás desde la firma al texto,
 * así que la tabla de descartes no deja guardado lo que alguien escribió.
 */
export function minhash(value: string): string {
  const grams = shingles(value);
  if (grams.length === 0) return "";

  const signature: number[] = [];
  for (let seed = 0; seed < HASHES; seed++) {
    let min = 0xffffffff;
    for (const gram of grams) {
      const hashed = hash32(gram, seed);
      if (hashed < min) min = hashed;
    }
    signature.push(min);
  }

  return signature.map((value) => value.toString(16).padStart(8, "0")).join("");
}

/** Cuánto se parecen dos firmas, de 0 a 1. */
export function similarity(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 0;

  let equal = 0;
  for (let index = 0; index < HASHES; index++) {
    const start = index * 8;
    if (a.slice(start, start + 8) === b.slice(start, start + 8)) equal++;
  }
  return equal / HASHES;
}

export const textHash = (text: ServiceText): string => sha256(words(bodyOf(text)).join(" "));

/**
 * Palabras que suenan a cada rubro. No es un clasificador: es lo mínimo para
 * notar que un servicio publicado en "salud" no dice nada de salud, y eso lo
 * sube en la cola, no lo rechaza.
 */
const CATEGORY_HINTS: Record<string, RegExp> = {
  ventas: /vende|venta|comercial|cliente|negocio|tienda/,
  "atencion-cliente": /atencion|cliente|reclamo|soporte|mesa de ayuda|recepcion/,
  administracion: /administra|gestion|tramite|oficina|secretari|archivo/,
  oficios: /electric|plomer|sanitari|albanil|carpinter|pintur|herrer|refrigeracion|obra|instala/,
  produccion: /produccion|fabrica|planta|maquina|industrial|envasado/,
  logistica: /logistic|reparto|flete|mudanza|deposito|transporte|chofer|entrega/,
  "contabilidad-finanzas": /contab|balance|impuesto|dgi|bps|factur|finanz|liquidacion/,
  tecnologia:
    /software|web|app|program|desarroll|sistema|red|servidor|base de datos|soporte tecnico/,
  "datos-analisis": /dato|analisis|estadistic|investigacion|informe|encuesta/,
  salud: /salud|enfermer|medic|cuidado|terapia|nutricion|psicolog|masaje|fisioterapia/,
  ingenieria: /ingenier|calculo|estructura|proyecto tecnico|plano|relevamiento/,
  marketing: /marketing|publicidad|redes sociales|contenido|community|campana|marca/,
  rrhh: /recursos humanos|seleccion|reclutamiento|nomina|capacitacion/,
  educacion: /clase|ensena|profesor|docente|tutor|curso|taller|idioma/,
  diseno: /diseno|grafic|logo|ilustra|editorial|ux|ui|foto|video|edicion/,
};

const CATEGORY_SLUGS = new Set(CATEGORIES.map((category) => category.slug));

/**
 * Tercera capa: si el texto no se parece al rubro que eligió y sí se parece a
 * otro, la cola lo muestra arriba con el rubro que sugiere el texto.
 */
export function coherence(text: ServiceText): Signal[] {
  const signals: Signal[] = [];
  const body = fold(bodyOf(text)).replace(/[^a-z0-9\s]+/g, " ");

  /** "otros" no promete nada, así que no hay incoherencia posible. */
  if (text.category !== "otros" && CATEGORY_SLUGS.has(text.category)) {
    const own = CATEGORY_HINTS[text.category];
    if (own && !own.test(body)) {
      const other = Object.entries(CATEGORY_HINTS).find(
        ([slug, pattern]) => slug !== text.category && pattern.test(body),
      );
      signals.push({
        code: "rubro",
        weight: other ? 20 : 10,
        detail: other ? `el texto se parece más a ${other[0]}` : "el texto no habla de ese rubro",
      });
    }
  }

  /** Un título que no nombra ningún puesto conocido y una descripción que no
   * comparte nada con el título es, casi siempre, relleno. */
  if (!roleOf(text.title)) {
    const titleWords = new Set(words(text.title).filter((word) => word.length > 3));
    const bodyWords = new Set(words(text.description));
    const shared = [...titleWords].filter((word) => bodyWords.has(word));

    if (titleWords.size > 0 && shared.length === 0) {
      signals.push({
        code: "titulo",
        weight: 10,
        detail: "el título no aparece en la descripción",
      });
    }
  }

  return signals;
}

/** Lo que ya se vio, para reconocer que el mismo texto volvió. */
export interface Print {
  /** Vacío cuando el servicio ya no existe: la firma sobrevive, el texto no. */
  service_id: string;
  kind: "published" | "rejected";
  text_hash: string;
  signature: string;
}

const SAME_TEXT = 1;
const NEAR_DUPLICATE = 0.75;

export function duplicates(text: ServiceText, prints: Print[]): Signal[] {
  const hash = textHash(text);
  const signature = minhash(bodyOf(text));

  let best: { print: Print; score: number } | null = null;

  for (const print of prints) {
    const score = print.text_hash === hash ? SAME_TEXT : similarity(signature, print.signature);
    if (!best || score > best.score) best = { print, score };
  }

  if (!best || best.score < NEAR_DUPLICATE) return [];

  const rejected = best.print.kind === "rejected";
  const exact = best.score === SAME_TEXT;

  return [
    {
      code: rejected ? "copia-rechazada" : "copia",
      /** Volver a subir lo que ya se rechazó pesa más que parecerse a algo
       * publicado, que puede ser la misma persona editando lo suyo. El mismo
       * texto exacto, palabra por palabra, es lo único que alcanza solo. */
      weight: rejected ? (exact ? 90 : 60) : 35,
      detail: exact
        ? `el mismo texto que ${rejected ? "ya se rechazó" : "ya está publicado"}`
        : `${Math.round(best.score * 100)}% parecido a ${rejected ? "algo rechazado" : "algo publicado"}`,
    },
  ];
}

const MAX_SCORE = 100;

/** Lo inequívoco: el mismo texto que ya se rechazó, sin nada que lo salve. */
const REJECT_AT = 85;

export function review(text: ServiceText, prints: Print[] = []): Review {
  const reasons = [...heuristics(text), ...duplicates(text, prints), ...coherence(text)];
  const score = Math.min(
    reasons.reduce((total, signal) => total + signal.weight, 0),
    MAX_SCORE,
  );

  const copiedFromRejected = reasons.some((signal) => signal.code === "copia-rechazada");

  return {
    score,
    reasons,
    decision: copiedFromRejected && score >= REJECT_AT ? "reject" : "queue",
  };
}
