import { Elysia } from "elysia";

/**
 * Apoyo voluntario (#33): un enlace, sin cuenta y sin seguimiento.
 *
 * Es un enlace a una página de afuera y nada más. No hay formulario, no hay
 * registro de quién apoyó ni de quién tocó el enlace, y no hay evento: el
 * navegador no manda nada cuando se abre. Lo que no se pide no se guarda.
 *
 * Sin contraprestación. Ni distintivo, ni función extra, ni prioridad: en el
 * momento en que apoyar desbloquea algo deja de ser apoyo y pasa a ser un plan
 * pago con otro nombre, con el tratamiento fiscal de una venta. Por eso este
 * archivo no importa nada de servicios, de cuentas ni de destacados, y
 * `support.test.ts` lo vigila.
 */

/**
 * Solo https y sin credenciales embebidas. El enlace va a una página ajena
 * (Cafecito, Ko-fi, Mercado Pago...), así que no se acepta nada que no sea una
 * URL web común. Vacío o inválido es "no hay enlace", no un error: la sección
 * simplemente no muestra el botón.
 */
export function supportUrl(raw: string | undefined = process.env.SUPPORT_URL): string | null {
  const value = raw?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const support = new Elysia().get("/api/support", () => ({ url: supportUrl() }));
