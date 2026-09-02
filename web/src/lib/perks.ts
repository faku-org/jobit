import { COURSES, DEGREES, catalogPattern, fold, foldWithIndex } from "./catalog.ts";
import type { Mark } from "./description.ts";
import type { Profile } from "./profile.ts";

/**
 * The good part of an offer is usually buried in the middle of the fourth
 * paragraph. These are the things worth stopping on, written the way employers
 * in Uruguay write them, so the sheet can pull them out and point at them.
 */
export interface Perk {
  id: string;
  label: string;
  pattern: RegExp;
}

export const PERKS: Perk[] = [
  {
    id: "efectivo",
    label: "Contrato efectivo",
    pattern:
      /(?:contrato|pase|ingreso|incorporaci[oó]n)\s+(?:a\s+)?(?:efectiv[oa]|planilla|plantilla)|relaci[oó]n de dependencia|efectividad/g,
  },
  {
    id: "capacitacion",
    label: "Capacitación paga",
    pattern:
      /capacitaci[oó]n(?:\s+(?:paga|constante|continua|a cargo|interna|inicial))?|se brinda formaci[oó]n|formaci[oó]n a cargo/g,
  },
  {
    id: "crecimiento",
    label: "Posibilidad de crecer",
    pattern:
      /(?:posibilidad(?:es)? de\s+)?(?:crecimiento|desarrollo)\s+(?:profesional|laboral|interno)|plan de carrera|promoci[oó]n interna|l[ií]nea de carrera/g,
  },
  {
    id: "salud",
    label: "Cobertura de salud",
    pattern: /mutualista|cobertura m[eé]dica|seguro de salud|emergencia m[oó]vil|obra social/g,
  },
  {
    id: "comisiones",
    label: "Comisiones o incentivos",
    pattern:
      /comisiones|incentivos|bonos? por (?:objetivos|productividad|cumplimiento)|premios? por/g,
  },
  {
    id: "flexible",
    label: "Horario flexible",
    pattern: /horario\s+flexible|flexibilidad horaria|horarios? a convenir|part[- ]time/g,
  },
  {
    id: "remoto",
    label: "Trabajo remoto o híbrido",
    pattern: /home ?office|teletrabajo|trabajo remoto|modalidad h[ií]brida|100% remoto/g,
  },
  {
    id: "viaticos",
    label: "Viáticos o transporte",
    pattern:
      /vi[aá]ticos|transporte (?:incluido|de la empresa|propio de la empresa)|traslado (?:incluido|a cargo)/g,
  },
  {
    id: "comida",
    label: "Comida o comedor",
    pattern:
      /comedor|almuerzo (?:incluido|a cargo)|vianda|desayuno incluido|t[ií]cket alimentaci[oó]n/g,
  },
  {
    id: "beneficios",
    label: "Beneficios adicionales",
    pattern:
      /beneficios? (?:corporativ|adicional|de la empresa|para colaborador)|descuentos? para (?:emplead|colaborador)|club de beneficios/g,
  },
  {
    id: "estudio",
    label: "Apoyo al estudio",
    pattern:
      /licencia por estudio|d[ií]as de estudio|apoyo (?:al|para el) estudio|beca de estudio/g,
  },
  {
    id: "sin-experiencia",
    label: "No pide experiencia",
    pattern:
      /(?:sin|no requiere|no se requiere|no es necesaria)\s+experiencia(?:\s+previa)?|primer empleo|primera experiencia laboral/g,
  },
  {
    id: "capacita-sin-experiencia",
    label: "Te enseñan el puesto",
    pattern: /te ense[ñn]amos|no import[ae] la experiencia|nosotros te capacitamos|se capacita/g,
  },
  {
    id: "buen-clima",
    label: "Buen ambiente de trabajo",
    pattern: /buen (?:clima|ambiente) (?:laboral|de trabajo)|excelente clima/g,
  },
  {
    id: "estabilidad",
    label: "Puesto estable",
    pattern: /puesto estable|estabilidad laboral|trabajo estable|largo plazo/g,
  },
];

/** Everything the catalog knows how to recognise, keyed by id. */
const CATALOG = new Map([...DEGREES, ...COURSES].map((entry) => [entry.id, entry]));

/** A regex kept across calls has state; each scan starts from the beginning. */
function scan(pattern: RegExp, text: string): { start: number; end: number }[] {
  const found: { start: number; end: number }[] = [];
  const search = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );

  for (const match of text.matchAll(search)) {
    if (match[0].length === 0) continue;
    found.push({ start: match.index, end: match.index + match[0].length });
  }
  return found;
}

/** Which perks an offer's text mentions at all, for the summary panel. */
export function findPerks(text: string): Perk[] {
  const haystack = fold(text);
  return PERKS.filter((perk) => scan(perk.pattern, haystack).length > 0);
}

/** Overlapping marks would nest; the first one to claim a stretch keeps it. */
function withoutOverlaps(marks: Mark[]): Mark[] {
  const sorted = [...marks].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Mark[] = [];

  for (const mark of sorted) {
    const last = kept[kept.length - 1];
    if (last && mark.start < last.end) continue;
    kept.push(mark);
  }
  return kept;
}

/**
 * Where to highlight, and why. Two things earn a highlight: something the
 * offer gives you, and something it asks for that you already have — the
 * second is the one that turns a wall of requirements into a decision.
 *
 * The search runs on the folded text and the hits are mapped back, so the
 * offsets returned index the string the person is actually reading.
 */
export function findMarks(text: string, profile: Profile): Mark[] {
  const { text: haystack, map } = foldWithIndex(text);
  const marks: Mark[] = [];

  /** Folded [start, end) back to the original string's own offsets. */
  const locate = (at: { start: number; end: number }) => ({
    start: map[at.start] ?? 0,
    end: at.end >= map.length ? text.length : (map[at.end] ?? text.length),
  });

  for (const perk of PERKS) {
    for (const at of scan(perk.pattern, haystack)) {
      marks.push({ ...locate(at), note: perk.label, tone: "perk" });
    }
  }

  for (const id of [...profile.degrees, ...profile.courses]) {
    const entry = CATALOG.get(id);
    if (!entry) continue;
    for (const at of scan(catalogPattern(entry), haystack)) {
      marks.push({ ...locate(at), note: `Lo tenés: ${entry.label}`, tone: "match" });
    }
  }

  return withoutOverlaps(marks.filter((mark) => mark.end > mark.start));
}

/** The catalog entries of yours that an offer names, for the summary panel. */
export function findProfileMatches(text: string, profile: Profile): string[] {
  const haystack = fold(text);

  return [...profile.degrees, ...profile.courses].flatMap((id) => {
    const entry = CATALOG.get(id);
    if (!entry) return [];
    return scan(catalogPattern(entry), haystack).length > 0 ? [entry.label] : [];
  });
}
