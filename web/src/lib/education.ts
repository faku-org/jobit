/**
 * El nivel educativo, solo: el tipo, el orden y cómo se escribe cada uno.
 *
 * Vive aparte de profile.ts porque el panel también lo necesita para leer las
 * estadísticas, y profile.ts arrastra el catálogo entero de títulos, que en el
 * panel no se usa para nada.
 */
export type EducationLevel =
  | "none"
  | "primary"
  | "secondary_basic"
  | "secondary"
  | "technical"
  | "university"
  | "postgrad";

export const EDUCATION_LEVELS: EducationLevel[] = [
  "none",
  "primary",
  "secondary_basic",
  "secondary",
  "technical",
  "university",
  "postgrad",
];

export const EDUCATION_LABEL: Record<EducationLevel, string> = {
  none: "Sin estudios formales",
  primary: "Primaria",
  secondary_basic: "Ciclo básico",
  secondary: "Bachillerato",
  technical: "Técnico o terciario",
  university: "Universitario",
  postgrad: "Posgrado",
};

/** El orden entre niveles, para comparar lo que pide una oferta con lo que
 * cargó la persona. */
export const EDUCATION_RANK: Record<EducationLevel, number> = {
  none: 0,
  primary: 1,
  secondary_basic: 2,
  secondary: 3,
  technical: 4,
  university: 5,
  postgrad: 6,
};
