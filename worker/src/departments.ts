/**
 * Los diecinueve departamentos, escritos una sola vez. Los usa el scraper para
 * leer dónde queda un llamado y la API para validar dónde se presta un
 * servicio: si cada lado tuviera su lista, "Paysandú" y "Paysandu" contarían
 * como dos lugares distintos en el tablero.
 */
export const DEPARTMENTS = [
  "Montevideo",
  "Canelones",
  "Maldonado",
  "Rocha",
  "Treinta y Tres",
  "Cerro Largo",
  "Rivera",
  "Artigas",
  "Salto",
  "Paysandú",
  "Río Negro",
  "Soriano",
  "Colonia",
  "San José",
  "Flores",
  "Florida",
  "Durazno",
  "Tacuarembó",
  "Lavalleja",
] as const;

export const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const BY_FOLDED = new Map(DEPARTMENTS.map((name) => [fold(name), name]));

/** El nombre canónico de lo que alguien escribió, o null si no es uno. */
export const departmentOf = (value: string | undefined): string | null =>
  BY_FOLDED.get(fold(value ?? "")) ?? null;

/**
 * Un texto que nombra lugares: un solo departamento es una ubicación, varios
 * quieren decir que es en todo el país y la lista queda mejor sin adivinar.
 */
export function singleDepartment(place: string | undefined): string | null {
  if (!place) return null;

  const haystack = fold(place);
  const found = DEPARTMENTS.filter((name) => haystack.includes(fold(name)));
  return found.length === 1 ? (found[0] ?? null) : null;
}
