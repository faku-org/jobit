import { type SubjectKind, issue } from "./email-tokens.ts";
import { publicUrl, send, verifyMail } from "./mail.ts";

/**
 * Mandar la verificación. Vive aparte de email.ts porque la llaman el alta y el
 * cambio de correo de personas y de empresas, y email.ts a su vez necesita los
 * nombres de cookie de esas dos: juntos serían un import circular.
 */

/** A dónde vuelve cada tipo de cuenta después de tocar el enlace. */
export const home = (kind: SubjectKind): string =>
  `${publicUrl()}${kind === "company" ? "/empresas" : "/"}`;

/**
 * Manda la verificación al correo que la cuenta tiene hoy. Devuelve si salió
 * algo, pero quien llama casi nunca lo muestra: "te mandamos un correo" es la
 * respuesta aunque el enfriamiento de diez minutos haya decidido no mandar.
 */
export async function sendVerification(
  kind: SubjectKind,
  id: string,
  email: string,
): Promise<boolean> {
  const token = issue("verify", kind, id, email);
  if (!token) return false;

  const link = `${publicUrl()}/api/auth/email/verify?token=${token}`;
  const sent = await send(verifyMail(email, link));
  if (!sent.ok) console.error(`[jobit] verificación sin mandar: ${sent.error}`);
  return sent.ok;
}

/** Desde el alta o el cambio de correo no se espera a Resend: la cuenta se crea
 * igual, y si el correo no salió, se reenvía desde el perfil. */
export function verifyInBackground(kind: SubjectKind, id: string, email: string): void {
  sendVerification(kind, id, email).catch((cause) =>
    console.error(`[jobit] verificación en segundo plano: ${String(cause)}`),
  );
}
