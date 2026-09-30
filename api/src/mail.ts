import { readFileSync } from "node:fs";
import type { Result } from "./types.ts";

/**
 * El correo saliente. Pasa por Resend y no por un SMTP propio, y no es por
 * comodidad: desde fines de 2025 Gmail y Microsoft rechazan en la puerta lo que
 * no autentica bien, y los rangos de IP de casi todos los VPS ya están en
 * listas de "esto no debería mandar correo". Con SPF, DKIM y DMARC perfectos,
 * un VPS nuevo igual arranca en spam. Lo que falta no es configuración sino
 * reputación, y esa la pone el relé. La comparación entera está en
 * docs/correo.md.
 *
 * Dos reglas que salen de que Resend guarda cada mensaje hasta 30 días en Estados
 * Unidos, y que no se negocian:
 *
 * - Solo texto plano. Sin HTML no hay píxel de seguimiento posible, ni imagen
 *   remota que avise cuándo se abrió, ni nada que el relé tenga que guardar
 *   además de lo que se lee.
 * - Nada de contenido. Un correo de JobIt dice que hay algo y trae un enlace;
 *   lo que haya del otro lado se ve adentro, con sesión. Nunca el nombre de
 *   una empresa, una oferta, un estado de postulación ni un mensaje.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

type Transport = (mail: Mail) => Promise<Result<string>>;

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

/** Un archivo con la clave le gana a la variable, igual que el resto de los
 * secretos del proyecto: nadie interpola un archivo en el camino. */
function resendKey(): string {
  const path = process.env.RESEND_API_KEY_FILE;
  if (path) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      return "";
    }
  }
  return (process.env.RESEND_API_KEY ?? "").trim();
}

const sender = (): string => process.env.MAIL_FROM?.trim() || "JobIt <no-responder@wefaber.net>";

/** La dirección pública desde la que se arman los enlaces de los correos. */
export const publicUrl = (): string =>
  (process.env.PUBLIC_URL?.trim() || "http://localhost:5173").replace(/\/+$/, "");

/**
 * En desarrollo no hay clave de Resend y no tiene por qué haberla: con
 * MAIL_TRANSPORT=console el correo se escribe en la consola en vez de salir.
 * Es explícito a propósito. Sin clave y sin esa variable, el correo queda
 * apagado, y lo que dependa de él lo dice en vez de fingir que mandó algo.
 */
const consoleTransport: Transport = async (mail) => {
  console.log(`[jobit] correo para ${mail.to}: ${mail.subject}\n${mail.text}`);
  return { ok: true, value: "consola" };
};

const resendTransport: Transport = async (mail) => {
  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    console.error(`[jobit] no se pudo hablar con Resend: ${String(cause)}`);
    return { ok: false, error: "no se pudo mandar el correo, probá en un rato" };
  }

  if (!response.ok) {
    /** El cuerpo de error de Resend no lleva la dirección, pero igual va al
     * log y no a la respuesta: quien pidió el correo no necesita saber por qué
     * falló el relé, y un atacante sí querría. */
    console.error(`[jobit] Resend respondió ${response.status}: ${await response.text()}`);
    return { ok: false, error: "no se pudo mandar el correo, probá en un rato" };
  }

  const body = (await response.json().catch(() => ({}))) as { id?: string };
  return { ok: true, value: body.id ?? "" };
};

let override: Transport | null = null;

/** Solo para los tests: capturar lo que se habría mandado. */
export function setTransport(transport: Transport | null): void {
  override = transport;
}

function transport(): Transport | null {
  if (override) return override;
  if (resendKey()) return resendTransport;
  if (process.env.MAIL_TRANSPORT === "console") return consoleTransport;
  return null;
}

export const mailEnabled = (): boolean => transport() !== null;

export async function send(mail: Mail): Promise<Result<string>> {
  const chosen = transport();
  if (!chosen) return { ok: false, error: "el correo no está configurado en este servidor" };
  return chosen(mail);
}

/* --- Plantillas -------------------------------------------------------------
   Todas dicen lo mismo de distinta forma: que hay algo y dónde verlo. Ninguna
   lleva datos de nadie, así que lo que Resend guarde hasta 30 días es un
   enlace que ya venció y una frase genérica. */

export const verifyMail = (to: string, link: string): Mail => ({
  to,
  subject: "Confirmá tu correo en JobIt",
  text: [
    "Para confirmar que este correo es tuyo, abrí este enlace:",
    "",
    link,
    "",
    "Vence en 24 horas y sirve una sola vez.",
    "Si no fuiste vos, ignoralo: sin confirmarlo no pasa nada.",
  ].join("\n"),
});

export const resetMail = (to: string, link: string): Mail => ({
  to,
  subject: "Cambiar la contraseña de JobIt",
  text: [
    "Alguien pidió cambiar la contraseña de la cuenta asociada a este correo.",
    "Si fuiste vos, abrí este enlace:",
    "",
    link,
    "",
    "Vence en 30 minutos y sirve una sola vez.",
    "Si no fuiste vos, ignoralo: la contraseña no cambia hasta que alguien abra el enlace.",
  ].join("\n"),
});

/** El molde de cualquier aviso futuro: nunca dice qué pasó, solo que pasó algo. */
export const noticeMail = (to: string): Mail => ({
  to,
  subject: "Tenés novedades en JobIt",
  text: [
    "Hay algo nuevo en tu cuenta de JobIt.",
    "",
    `${publicUrl()}/`,
    "",
    "Por privacidad, los correos de JobIt nunca dicen qué es: se ve adentro, con tu sesión.",
  ].join("\n"),
});
