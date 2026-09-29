import type { Result } from "./types.ts";

/**
 * La política de contraseñas, en un solo lugar porque la comparten las dos
 * puertas que crean cuentas: la de quien publica un servicio (`users.ts`) y la
 * de la empresa (`company-accounts.ts`). Antes cada una tenía su propio mínimo
 * y alcanzaba con ocho letras.
 *
 * No pretende ser un medidor de entropía —eso pide una dependencia y un
 * diccionario grande—: exige un largo que aguante el ataque por fuerza bruta,
 * pide variedad de caracteres para que no sea una palabra sola, y descarta las
 * que ya están en cualquier lista de claves filtradas.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/** Las de siempre. No es la lista entera: es la parte que de verdad se repite. */
const COMMON = new Set([
  "1234567890",
  "12345678901",
  "123456789012",
  "contrasena",
  "contraseña",
  "password",
  "password1",
  "qwerty12345",
  "qwertyuiop",
  "iloveyou",
  "administrador",
  "bienvenido",
  "jobit12345",
  "1234567890",
]);

interface Classes {
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
}

function classesOf(value: string): Classes {
  return {
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

/**
 * Valida y devuelve la contraseña tal cual vino. Texto vacío o fuera de rango
 * cae con el mismo mensaje: es lo único que ve quien se equivoca.
 */
export function checkPassword(raw: string): Result<string> {
  if (raw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `la contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres` };
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: "esa contraseña es demasiado larga" };
  }

  const classes = classesOf(raw);
  const variety = [classes.lower, classes.upper, classes.digit, classes.symbol].filter(Boolean);
  if (variety.length < 2) {
    return {
      ok: false,
      error: "combiná mayúsculas, minúsculas, números o símbolos: no alcanza con un solo tipo",
    };
  }

  if (COMMON.has(raw.toLowerCase())) {
    return { ok: false, error: "esa contraseña es de las más usadas y se adivina sola" };
  }

  return { ok: true, value: raw };
}
