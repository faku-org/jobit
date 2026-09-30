import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "./db.ts";
import { publicUrl } from "./mail.ts";
import type { Result } from "./types.ts";
import * as users from "./users.ts";

/**
 * Llaves de acceso como segundo paso, en lugar de TOTP.
 *
 * La diferencia que importa: para verificar un código TOTP el servidor tiene
 * que poder generarlo, o sea tener el secreto. Con WebAuthn guarda la clave
 * pública de la llave y verifica una firma; no hay nada de nuestro lado que
 * sirva para entrar. Es la única forma de que el segundo paso cumpla la regla
 * de que JobIt no tiene con qué hacerse pasar por nadie.
 *
 * Es segundo paso y no reemplaza a la contraseña, a propósito: la contraseña
 * es de donde va a salir la clave que abre lo cifrado de punta a punta
 * (docs/cero-acceso.md). Entrar solo con la llave dejaría ese contenido sin
 * forma de abrirse, salvo con la extensión PRF, que todavía no anda en todos
 * lados.
 */
const CHALLENGE_MS = 5 * 60_000;
const MAX_PASSKEYS = 10;
const MAX_NAME = 60;

export type ChallengePurpose = "register" | "login";

/** El sitio para el que valen las llaves. Sale de PUBLIC_URL: una llave creada
 * en jobs.wefaber.net no sirve en ningún otro dominio, y eso es la mitad de
 * por qué WebAuthn no se puede pescar con una página falsa. */
function relyingParty(): { rpID: string; origin: string } {
  const url = new URL(publicUrl());
  return { rpID: url.hostname, origin: url.origin };
}

const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const today = (now: Date): string => now.toISOString().slice(0, 10);

interface PasskeyRow {
  credential_id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string;
  name: string;
  created_on: string;
}

/** Lo que ve la persona de sus llaves: un nombre y el día del alta. */
export interface PublicPasskey {
  id: string;
  name: string;
  created_on: string;
}

const rowsFor = (userId: string): PasskeyRow[] =>
  db()
    .query<PasskeyRow, [string]>(
      "SELECT * FROM user_passkeys WHERE user_id = ? ORDER BY created_on",
    )
    .all(userId);

const transportsOf = (row: PasskeyRow): AuthenticatorTransport[] =>
  row.transports ? (row.transports.split(",") as AuthenticatorTransport[]) : [];

export const listFor = (userId: string): PublicPasskey[] =>
  rowsFor(userId).map((row) => ({
    id: row.credential_id,
    name: row.name,
    created_on: row.created_on,
  }));

export const countFor = (userId: string): number =>
  db()
    .query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM user_passkeys WHERE user_id = ?")
    .get(userId)?.n ?? 0;

export function remove(userId: string, credentialId: string): boolean {
  return (
    db().run("DELETE FROM user_passkeys WHERE user_id = ? AND credential_id = ?", [
      userId,
      credentialId,
    ]).changes > 0
  );
}

/* --- Desafíos -------------------------------------------------------------- */

function saveChallenge(
  purpose: ChallengePurpose,
  userId: string,
  challenge: string,
  now: Date,
): string {
  db().run("DELETE FROM webauthn_challenges WHERE expires_at <= ?", [now.toISOString()]);
  /** Un desafío vigente por persona y motivo: pedir otro invalida el anterior. */
  db().run("DELETE FROM webauthn_challenges WHERE user_id = ? AND purpose = ?", [userId, purpose]);

  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  db().run(
    `INSERT INTO webauthn_challenges (token_hash, purpose, user_id, challenge, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      sha256(token),
      purpose,
      userId,
      challenge,
      new Date(now.getTime() + CHALLENGE_MS).toISOString(),
    ],
  );
  return token;
}

/** Lo consume: un desafío sirve para una sola firma. */
function takeChallenge(
  purpose: ChallengePurpose,
  token: string,
  now: Date,
): { userId: string; challenge: string } | null {
  const row = db()
    .query<{ user_id: string; challenge: string }, [string, string, string]>(
      `SELECT user_id, challenge FROM webauthn_challenges
        WHERE token_hash = ? AND purpose = ? AND expires_at > ?`,
    )
    .get(sha256(token), purpose, now.toISOString());
  db().run("DELETE FROM webauthn_challenges WHERE token_hash = ?", [sha256(token)]);
  return row ? { userId: row.user_id, challenge: row.challenge } : null;
}

export const CHALLENGE_SECONDS = CHALLENGE_MS / 1000;

/* --- Alta de una llave ------------------------------------------------------- */

export interface Pending<T> {
  options: T;
  /** Va en una cookie HttpOnly: es lo que ata la respuesta al desafío. */
  token: string;
}

export async function startRegistration(
  user: users.User,
  now: Date = new Date(),
): Promise<Result<Pending<PublicKeyCredentialCreationOptionsJSON>>> {
  const existing = rowsFor(user.id);
  if (existing.length >= MAX_PASSKEYS) {
    return { ok: false, error: `no se pueden tener más de ${MAX_PASSKEYS} llaves` };
  }

  const { rpID } = relyingParty();
  const options = await generateRegistrationOptions({
    rpName: "JobIt",
    rpID,
    /** El handle y no el correo: el nombre que queda guardado en la llave es
     * lo que muestra el sistema operativo, y el correo puede no existir. */
    userName: user.handle,
    userDisplayName: user.display_name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((row) => ({
      id: row.credential_id,
      transports: transportsOf(row),
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  return {
    ok: true,
    value: { options, token: saveChallenge("register", user.id, options.challenge, now) },
  };
}

export async function finishRegistration(
  user: users.User,
  token: string,
  response: RegistrationResponseJSON,
  name: string,
  now: Date = new Date(),
): Promise<Result<PublicPasskey>> {
  const pending = takeChallenge("register", token, now);
  if (!pending || pending.userId !== user.id) {
    return { ok: false, error: "el pedido venció, probá de nuevo" };
  }

  const { rpID, origin } = relyingParty();
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      /** Segundo paso después de la contraseña: una llave física sin PIN
       * alcanza. Si algún día se entra solo con la llave, esto pasa a true. */
      requireUserVerification: false,
    });
  } catch (cause) {
    console.error(`[jobit] alta de llave rechazada: ${String(cause)}`);
    return { ok: false, error: "la llave no se pudo verificar" };
  }
  if (!verified.verified) return { ok: false, error: "la llave no se pudo verificar" };

  const { credential } = verified.registrationInfo;
  const row: PasskeyRow = {
    credential_id: credential.id,
    user_id: user.id,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: (credential.transports ?? []).join(","),
    name: name.trim().slice(0, MAX_NAME) || "Llave de acceso",
    created_on: today(now),
  };

  try {
    db().run(
      `INSERT INTO user_passkeys (credential_id, user_id, public_key, counter, transports, name, created_on)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.credential_id,
        row.user_id,
        row.public_key,
        row.counter,
        row.transports,
        row.name,
        row.created_on,
      ],
    );
  } catch {
    return { ok: false, error: "esa llave ya está registrada" };
  }

  /**
   * Con una llave puesta, el TOTP sobra, y su secreto es lo único que le
   * quedaba a JobIt con que generar un segundo paso ajeno. Se borra acá, en el
   * mismo movimiento, para que no quede ni un día de más.
   */
  if (user.totp_enabled || user.totp_secret_enc) users.disableTotp(user.id);

  return { ok: true, value: { id: row.credential_id, name: row.name, created_on: row.created_on } };
}

/* --- Entrar con una llave ---------------------------------------------------- */

export async function startLogin(
  user: users.User,
  now: Date = new Date(),
): Promise<Pending<PublicKeyCredentialRequestOptionsJSON>> {
  const { rpID } = relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: rowsFor(user.id).map((row) => ({
      id: row.credential_id,
      transports: transportsOf(row),
    })),
    userVerification: "preferred",
  });
  return { options, token: saveChallenge("login", user.id, options.challenge, now) };
}

/** Devuelve de quién es la firma, si es buena. */
export async function finishLogin(
  token: string,
  response: AuthenticationResponseJSON,
  now: Date = new Date(),
): Promise<Result<string>> {
  const failed: Result<string> = { ok: false, error: "la llave no coincide" };

  const pending = takeChallenge("login", token, now);
  if (!pending) return { ok: false, error: "el segundo paso venció, volvé a entrar" };

  const row = db()
    .query<PasskeyRow, [string, string]>(
      "SELECT * FROM user_passkeys WHERE credential_id = ? AND user_id = ?",
    )
    .get(response.id, pending.userId);
  if (!row) return failed;

  const { rpID, origin } = relyingParty();
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: row.credential_id,
        publicKey: new Uint8Array(Buffer.from(row.public_key, "base64url")),
        counter: row.counter,
        transports: transportsOf(row),
      },
      requireUserVerification: false,
    });
  } catch (cause) {
    console.error(`[jobit] firma de llave rechazada: ${String(cause)}`);
    return failed;
  }
  if (!verified.verified) return failed;

  /** El contador sirve para detectar una llave clonada. Las que se sincronizan
   * entre dispositivos mandan siempre 0, y la biblioteca ya lo contempla. */
  db().run("UPDATE user_passkeys SET counter = ? WHERE credential_id = ?", [
    verified.authenticationInfo.newCounter,
    row.credential_id,
  ]);
  return { ok: true, value: pending.userId };
}
