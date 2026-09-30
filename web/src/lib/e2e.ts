/**
 * Cifrado de punta a punta: lo que se cierra acá solo lo abre quien tiene la
 * clave privada, y la clave privada nunca llega al servidor en claro. El diseño
 * completo, con lo que cuesta, está en docs/cero-acceso.md; esto es el núcleo,
 * sin red ni estado, para que se pueda probar entero con bun test.
 *
 * Todo es WebCrypto nativo: PBKDF2, HKDF, ECDH P-256 y AES-256-GCM. Nada de
 * WASM, porque cargarlo pide 'wasm-unsafe-eval' en el CSP.
 *
 * Tres piezas:
 *
 *   1. derive()   Un secreto (contraseña o código de respaldo) da dos claves
 *                 independientes: `auth`, que va al servidor en lugar del
 *                 secreto, y `wrap`, que no sale del navegador.
 *   2. wrap*()    La clave privada de la cuenta, envuelta con `wrap`. Para el
 *                 servidor es un blob que no significa nada.
 *   3. seal()     Un sobre: el contenido cifrado con una clave al azar, y esa
 *                 clave envuelta para cada destinatario con su clave pública.
 *
 * Cada cifrado lleva un contexto como dato asociado (AAD). Un sobre cerrado
 * para "sync" no abre como "postulación:123", así que el servidor no puede
 * cambiar un blob de lugar y hacerlo pasar por otro.
 */

const VERSION = 1;
const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------------------------------------------------------------- base64url */

export function toBase64url(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const random = (length: number): Uint8Array<ArrayBuffer> =>
  crypto.getRandomValues(new Uint8Array(length));

const aad = (...parts: string[]): Uint8Array<ArrayBuffer> =>
  enc.encode(["jobit", `v${VERSION}`, ...parts].join("\0"));

/* ------------------------------------------------------------------- derive */

/**
 * PBKDF2-SHA256 con 600.000 iteraciones, lo que recomienda OWASP hoy para
 * PBKDF2. Argon2id aguanta mejor una GPU, y por eso los parámetros viajan con
 * cada cuenta: pasar a otro KDF es reenvolver una clave, no recifrar nada.
 */
export const DEFAULT_ITERATIONS = 600_000;

export interface KdfParams {
  kdf: "PBKDF2-SHA256";
  iterations: number;
  /** base64url, 16 bytes, uno por cuenta y por código. Es público. */
  salt: string;
}

export const newKdfParams = (iterations: number = DEFAULT_ITERATIONS): KdfParams => ({
  kdf: "PBKDF2-SHA256",
  iterations,
  salt: toBase64url(random(16)),
});

export type SecretKind = "password" | "code";

export interface Derived {
  /** Lo que se manda al servidor en lugar del secreto. El servidor le aplica
   * argon2id encima, como hace hoy con la contraseña. base64url, 32 bytes. */
  auth: string;
  /** Envuelve y desenvuelve la clave privada. No es exportable. */
  wrap: CryptoKey;
}

/** Los códigos se muestran con guiones y se tipean como sea: mismo criterio
 * que normaliseCode en api/src/users.ts. La contraseña se normaliza a NFC
 * para que la misma tecla dé los mismos bytes en cualquier teclado. */
const normalise = (secret: string, kind: SecretKind): string =>
  kind === "code" ? secret.toUpperCase().replace(/[^0-9A-Z]/g, "") : secret.normalize("NFC");

/**
 * La parte cara (PBKDF2) corre una sola vez y HKDF saca las dos claves de ahí,
 * con etiquetas distintas. Conocer `auth` no dice nada de `wrap`: para llegar
 * de una a la otra hay que volver a pasar por el secreto.
 *
 * Los códigos de respaldo pasan por lo mismo que la contraseña. Hoy el
 * servidor guarda sha256(código), que alcanza para autenticar pero, el día que
 * un código envuelva una copia de la clave privada, es un atajo para probar
 * códigos offline a velocidad de GPU. Con esto el servidor guarda un derivado
 * de `auth`, y probar un código cuesta un PBKDF2 entero.
 */
export async function derive(
  secret: string,
  kind: SecretKind,
  params: KdfParams,
): Promise<Derived> {
  if (params.kdf !== "PBKDF2-SHA256") throw new Error(`KDF desconocido: ${params.kdf}`);
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalise(secret, kind)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const master = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64url(params.salt),
      iterations: params.iterations,
    },
    base,
    256,
  );
  const hkdf = await crypto.subtle.importKey("raw", master, "HKDF", false, [
    "deriveBits",
    "deriveKey",
  ]);
  const info = (purpose: string) => ({
    name: "HKDF",
    hash: "SHA-256",
    salt: new Uint8Array(0),
    info: aad(kind, purpose),
  });
  const auth = await crypto.subtle.deriveBits(info("auth"), hkdf, 256);
  const wrap = await crypto.subtle.deriveKey(
    info("wrap"),
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
  return { auth: toBase64url(auth), wrap };
}

/* ------------------------------------------------------------ account keys */

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

export interface AccountKeys {
  publicKey: CryptoKey;
  /** Exportable solo al crearla, para poder envolverla. La que sale de
   * unwrapPrivateKey no lo es, salvo que se pida para reenvolverla. */
  privateKey: CryptoKey;
}

export async function generateAccountKeys(): Promise<AccountKeys> {
  const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/** La pública en crudo (65 bytes, sin comprimir), base64url. Es lo que se
 * guarda en el servidor y lo que se le pasa a quien quiera escribirte. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  return toBase64url(await crypto.subtle.exportKey("raw", key));
}

export function importPublicKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64url(raw), ECDH, true, []);
}

/** Para encontrar el casillero propio en un sobre sin probar todos: los
 * primeros 16 bytes del sha256 de la pública. */
export async function keyId(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return toBase64url(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)).slice(0, 16));
}

export interface WrappedKey {
  v: typeof VERSION;
  iv: string;
  data: string;
}

/**
 * `label` distingue las copias: "password" para la que abre la contraseña,
 * "code:<n>" para cada código de respaldo. Va como AAD, así que una copia no
 * se puede presentar en el lugar de otra.
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  wrap: CryptoKey,
  label: string,
): Promise<WrappedKey> {
  const iv = random(12);
  const data = await crypto.subtle.wrapKey("pkcs8", privateKey, wrap, {
    name: "AES-GCM",
    iv,
    additionalData: aad("private-key", label),
  });
  return { v: VERSION, iv: toBase64url(iv), data: toBase64url(data) };
}

/** Falla (rechaza) si la clave `wrap` no es la que la envolvió, si el blob se
 * tocó o si `label` no es el de cuando se envolvió. */
export function unwrapPrivateKey(
  wrapped: WrappedKey,
  wrap: CryptoKey,
  label: string,
  { extractable = false }: { extractable?: boolean } = {},
): Promise<CryptoKey> {
  if (wrapped.v !== VERSION) throw new Error(`versión desconocida: ${wrapped.v}`);
  return crypto.subtle.unwrapKey(
    "pkcs8",
    fromBase64url(wrapped.data),
    wrap,
    { name: "AES-GCM", iv: fromBase64url(wrapped.iv), additionalData: aad("private-key", label) },
    ECDH,
    extractable,
    ["deriveBits"],
  );
}

/* ---------------------------------------------------------------- envelopes */

export interface Slot {
  /** keyId() del destinatario. */
  kid: string;
  /** Pública efímera, una por casillero, en crudo. */
  epk: string;
  iv: string;
  key: string;
}

export interface Envelope {
  v: typeof VERSION;
  iv: string;
  data: string;
  slots: Slot[];
}

/** ECDH entre la efímera y la del destinatario, y HKDF con las dos públicas
 * de sal: la clave que envuelve queda atada a ese par y a ese contexto. */
async function slotKey(
  own: CryptoKey,
  other: CryptoKey,
  epkRaw: Uint8Array<ArrayBuffer>,
  recipientRaw: Uint8Array<ArrayBuffer>,
  context: string,
  usage: "wrapKey" | "unwrapKey",
): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: other }, own, 256);
  const hkdf = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  const salt = new Uint8Array(epkRaw.length + recipientRaw.length);
  salt.set(epkRaw);
  salt.set(recipientRaw, epkRaw.length);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: aad("slot", context) },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

/**
 * Cierra `plaintext` para cada clave pública de `recipients`. Una postulación
 * lleva dos: la de la empresa y la de quien postula, que así puede releer lo
 * que mandó. El sync lleva una sola, la propia.
 *
 * El servidor ve el tamaño y cuántos destinatarios hay. Nada más.
 */
export async function seal(
  plaintext: Uint8Array<ArrayBuffer>,
  recipients: CryptoKey[],
  context: string,
): Promise<Envelope> {
  if (recipients.length === 0) throw new Error("un sobre sin destinatarios no lo abre nadie");
  const content = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = random(12);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad("content", context) },
    content,
    plaintext,
  );

  const slots: Slot[] = [];
  for (const recipient of recipients) {
    const ephemeral = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
    const epkRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
    const recipientRaw = new Uint8Array(await crypto.subtle.exportKey("raw", recipient));
    const kek = await slotKey(
      ephemeral.privateKey,
      recipient,
      epkRaw,
      recipientRaw,
      context,
      "wrapKey",
    );
    const slotIv = random(12);
    const key = await crypto.subtle.wrapKey("raw", content, kek, {
      name: "AES-GCM",
      iv: slotIv,
      additionalData: aad("slot-key", context),
    });
    slots.push({
      kid: await keyId(recipient),
      epk: toBase64url(epkRaw),
      iv: toBase64url(slotIv),
      key: toBase64url(key),
    });
  }

  return { v: VERSION, iv: toBase64url(iv), data: toBase64url(data), slots };
}

export type Opened<T> = { ok: true; value: T } | { ok: false; error: string };

/** Abre un sobre con el par propio. No tira: cualquier falla (no es para esta
 * clave, lo tocaron, otro contexto) vuelve como error, sin decir cuál, porque
 * para quien lo abre las tres quieren decir lo mismo: esto no se puede leer. */
export async function open(
  envelope: Envelope,
  keys: { publicKey: CryptoKey; privateKey: CryptoKey },
  context: string,
): Promise<Opened<Uint8Array<ArrayBuffer>>> {
  if (envelope.v !== VERSION) return { ok: false, error: "versión desconocida" };
  const kid = await keyId(keys.publicKey);
  const slot = envelope.slots.find((candidate) => candidate.kid === kid);
  if (!slot) return { ok: false, error: "este sobre no es para esta cuenta" };
  try {
    const epkRaw = fromBase64url(slot.epk);
    const recipientRaw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
    const ephemeral = await crypto.subtle.importKey("raw", epkRaw, ECDH, false, []);
    const kek = await slotKey(
      keys.privateKey,
      ephemeral,
      epkRaw,
      recipientRaw,
      context,
      "unwrapKey",
    );
    const content = await crypto.subtle.unwrapKey(
      "raw",
      fromBase64url(slot.key),
      kek,
      { name: "AES-GCM", iv: fromBase64url(slot.iv), additionalData: aad("slot-key", context) },
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64url(envelope.iv), additionalData: aad("content", context) },
      content,
      fromBase64url(envelope.data),
    );
    return { ok: true, value: new Uint8Array(plain) };
  } catch {
    return { ok: false, error: "no se pudo abrir" };
  }
}

export const sealJson = (value: unknown, recipients: CryptoKey[], context: string) =>
  seal(enc.encode(JSON.stringify(value)), recipients, context);

export async function openJson<T>(
  envelope: Envelope,
  keys: { publicKey: CryptoKey; privateKey: CryptoKey },
  context: string,
): Promise<Opened<T>> {
  const opened = await open(envelope, keys, context);
  if (!opened.ok) return opened;
  try {
    return { ok: true, value: JSON.parse(dec.decode(opened.value)) as T };
  } catch {
    return { ok: false, error: "no se pudo abrir" };
  }
}

/* ---------------------------------------------------------------- the vault */

/**
 * Todo lo que el servidor guarda de una cuenta para que el cifrado funcione.
 * Ninguna parte le sirve para leer nada: la pública es pública, las copias de
 * la privada están envueltas con claves que solo salen de la contraseña o de
 * un código, y los `auth` que recibe los guarda pasados por argon2id.
 */
export interface Vault {
  publicKey: string;
  password: { params: KdfParams; wrapped: WrappedKey };
  /**
   * Una sal para todos los códigos de la cuenta, no una por código: quien
   * recupera no sabe cuál de los ocho tiene en la mano, y con una sal por
   * código habría que correr ocho PBKDF2 para averiguarlo. Así corre uno y
   * prueba el desenvolver (barato) contra cada copia. El costo es que quien
   * ataque prueba cada intento contra los ocho a la vez: con ~49 bits por
   * código y 600.000 iteraciones por intento, sigue siendo inviable.
   */
  codes: { params: KdfParams; wrapped: WrappedKey[] };
}

export interface NewVault {
  vault: Vault;
  keys: AccountKeys;
  /** Lo que va al servidor en lugar de la contraseña. */
  passwordAuth: string;
  /** Uno por código, en el mismo orden: el servidor guarda estos (con
   * argon2id), no sha256(código). */
  codeAuths: string[];
}

/** El alta: genera el par, lo envuelve con la contraseña y con cada código. */
export async function createVault(
  password: string,
  codes: string[],
  iterations: number = DEFAULT_ITERATIONS,
): Promise<NewVault> {
  const keys = await generateAccountKeys();
  const passwordParams = newKdfParams(iterations);
  const fromPassword = await derive(password, "password", passwordParams);

  const codeParams = newKdfParams(iterations);
  const codeWrapped: WrappedKey[] = [];
  const codeAuths: string[] = [];
  for (const [index, code] of codes.entries()) {
    const derived = await derive(code, "code", codeParams);
    codeWrapped.push(await wrapPrivateKey(keys.privateKey, derived.wrap, `code:${index}`));
    codeAuths.push(derived.auth);
  }

  return {
    vault: {
      publicKey: await exportPublicKey(keys.publicKey),
      password: {
        params: passwordParams,
        wrapped: await wrapPrivateKey(keys.privateKey, fromPassword.wrap, "password"),
      },
      codes: { params: codeParams, wrapped: codeWrapped },
    },
    keys,
    passwordAuth: fromPassword.auth,
    codeAuths,
  };
}

/** Entrar: la contraseña abre la privada. Rechaza si la contraseña no es. */
export async function unlockWithPassword(
  vault: Vault,
  password: string,
): Promise<{ keys: AccountKeys; auth: string }> {
  const derived = await derive(password, "password", vault.password.params);
  const privateKey = await unwrapPrivateKey(vault.password.wrapped, derived.wrap, "password");
  return {
    keys: { publicKey: await importPublicKey(vault.publicKey), privateKey },
    auth: derived.auth,
  };
}

/**
 * Cambiar la contraseña: la privada se reenvuelve con la nueva. Ningún sobre se
 * toca, porque ninguno está cerrado con la contraseña. Pide la vieja porque
 * es la única forma de abrir la privada exportable.
 */
export async function changePassword(
  vault: Vault,
  current: string,
  next: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<{ vault: Vault; auth: string }> {
  const old = await derive(current, "password", vault.password.params);
  const privateKey = await unwrapPrivateKey(vault.password.wrapped, old.wrap, "password", {
    extractable: true,
  });
  return rewrapPassword(vault, privateKey, next, iterations);
}

/**
 * Recuperar con un código: el código abre su copia de la privada y se
 * reenvuelve con la contraseña nueva. Devuelve `index` para que el servidor
 * queme esa copia junto con el código. Sin el código ni la contraseña no hay
 * camino: por diseño, soporte no puede recuperar el contenido de nadie.
 *
 * Quemar el código (sacar su copia) lo hace el servidor al aceptar el `auth`.
 */
export async function recoverWithCode(
  vault: Vault,
  code: string,
  next: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<{ vault: Vault; auth: string; codeAuth: string; index: number }> {
  const derived = await derive(code, "code", vault.codes.params);
  for (const [index, wrapped] of vault.codes.wrapped.entries()) {
    let privateKey: CryptoKey;
    try {
      privateKey = await unwrapPrivateKey(wrapped, derived.wrap, `code:${index}`, {
        extractable: true,
      });
    } catch {
      continue;
    }
    const rewrapped = await rewrapPassword(vault, privateKey, next, iterations);
    return { ...rewrapped, codeAuth: derived.auth, index };
  }
  throw new Error("ese código no abre ninguna copia");
}

async function rewrapPassword(
  vault: Vault,
  privateKey: CryptoKey,
  next: string,
  iterations: number,
): Promise<{ vault: Vault; auth: string }> {
  const params = newKdfParams(iterations);
  const fresh = await derive(next, "password", params);
  return {
    vault: {
      ...vault,
      password: { params, wrapped: await wrapPrivateKey(privateKey, fresh.wrap, "password") },
    },
    auth: fresh.auth,
  };
}
