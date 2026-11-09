import type { Result } from "./types.ts";

/**
 * El envío de correo, por Resend (https://resend.com) sobre `fetch`.
 *
 * Se eligió un proveedor por HTTP y no SMTP por dos razones: no agrega una
 * dependencia —`fetch` ya está— y un servicio con dominio e IP propios firma
 * SPF/DKIM por vos, que es lo que separa la bandeja de entrada del spam. Con
 * SMTP casero la entrega queda a cargo de una IP que nadie conoce.
 *
 * Sin `RESEND_API_KEY` no se manda: se escribe en el log lo que se habría
 * mandado, con el enlace adentro. Así el alta y la verificación se prueban en
 * local sin dar de alta un dominio.
 */
const ENDPOINT = "https://api.resend.com/emails";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const apiKey = (): string => (process.env.RESEND_API_KEY ?? "").trim();
const from = (): string => (process.env.MAIL_FROM ?? "").trim();

export const mailEnabled = (): boolean => apiKey() !== "" && from() !== "";

/** El origen público con el que se arman los enlaces de los correos. */
export function publicOrigin(): string {
  return (process.env.PUBLIC_ORIGIN ?? "https://jobs.wefaber.net").replace(/\/+$/, "");
}

export async function sendMail(mail: Mail): Promise<Result<void>> {
  if (!mailEnabled()) {
    console.log(`[jobit] correo para ${mail.to}: ${mail.subject}\n${mail.text}`);
    return { ok: true, value: undefined };
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });
  } catch {
    return { ok: false, error: "no se pudo contactar al servicio de correo" };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[jobit] resend respondió ${response.status}: ${detail.slice(0, 300)}`);
    return { ok: false, error: "el servicio de correo rechazó el envío" };
  }
  return { ok: true, value: undefined };
}
