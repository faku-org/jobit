/**
 * La misma política que valida la API, del lado del navegador para poder
 * mostrarla en vivo. El servidor la vuelve a aplicar: esto es comodidad, no
 * seguridad.
 */
export const MIN_PASSWORD = 10;

export interface PasswordRule {
  label: string;
  ok: boolean;
}

export function passwordRules(value: string): PasswordRule[] {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(value),
  ).length;

  return [
    { label: `Al menos ${MIN_PASSWORD} caracteres`, ok: value.length >= MIN_PASSWORD },
    {
      label: "Mayúsculas, minúsculas, números o símbolos (dos tipos)",
      ok: classes >= 2,
    },
  ];
}

export const passwordOk = (value: string): boolean =>
  passwordRules(value).every((rule) => rule.ok);
