import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";
process.env.PUBLIC_URL = "https://jobs.test";
process.env.JOBIT_SECRET_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
  "base64",
);

const { closeDb, db } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const users = await import("./users.ts");
const { app } = await import("./index.ts");

const ORIGIN = "https://jobs.test";
const RP_ID = "jobs.test";

beforeEach(() => {
  closeDb();
  resetLimits();
});

/* --- Un autenticador de mentira, pero con criptografía de verdad -------------
   Lo mismo que hace una llave física o el lector de huella: un par ECDSA
   P-256, los bytes que manda el RFC y una firma DER. Si la API acepta esto,
   acepta lo que manda un navegador; si lo rechaza, es por lo mismo que
   rechazaría a uno. */

const b64url = (bytes: Uint8Array | ArrayBuffer): string =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, part) => n + part.length, 0)));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const sha256 = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

/** CBOR mínimo: enteros, bytes, texto y mapas, que es todo lo que usa WebAuthn. */
function cborHead(major: number, value: number): Uint8Array {
  if (value < 24) return new Uint8Array([(major << 5) | value]);
  if (value < 256) return new Uint8Array([(major << 5) | 24, value]);
  return new Uint8Array([(major << 5) | 25, value >> 8, value & 255]);
}

type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;

function cbor(value: Cbor): Uint8Array {
  if (typeof value === "number") {
    return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  }
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    return concat(cborHead(3, bytes.length), bytes);
  }
  if (value instanceof Uint8Array) return concat(cborHead(2, value.length), value);
  const entries = [...value.entries()].flatMap(([k, v]) => [cbor(k), cbor(v)]);
  return concat(cborHead(5, value.size), ...entries);
}

/** WebCrypto firma en r||s; WebAuthn quiere la misma firma en ASN.1 DER. */
function toDer(raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array): Uint8Array => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    let trimmed = bytes.slice(start);
    if ((trimmed[0] ?? 0) & 0x80) trimmed = concat(new Uint8Array([0]), trimmed);
    return concat(new Uint8Array([0x02, trimmed.length]), trimmed);
  };
  const body = concat(integer(raw.slice(0, 32)), integer(raw.slice(32)));
  return concat(new Uint8Array([0x30, body.length]), body);
}

interface Authenticator {
  id: Uint8Array;
  keys: CryptoKeyPair;
}

async function newAuthenticator(): Promise<Authenticator> {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return { id: crypto.getRandomValues(new Uint8Array(16)), keys };
}

const FLAGS_PRESENT = 0x01;
const FLAGS_VERIFIED = 0x04;
const FLAGS_ATTESTED = 0x40;

async function attestation(auth: Authenticator, challenge: string, origin = ORIGIN) {
  const jwk = await crypto.subtle.exportKey("jwk", auth.keys.publicKey);
  const coseKey = cbor(
    new Map<Cbor, Cbor>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, new Uint8Array(Buffer.from(jwk.x ?? "", "base64url"))],
      [-3, new Uint8Array(Buffer.from(jwk.y ?? "", "base64url"))],
    ]),
  );

  const authData = concat(
    await sha256(new TextEncoder().encode(RP_ID)),
    new Uint8Array([FLAGS_PRESENT | FLAGS_VERIFIED | FLAGS_ATTESTED]),
    new Uint8Array([0, 0, 0, 0]),
    new Uint8Array(16),
    new Uint8Array([0, auth.id.length]),
    auth.id,
    coseKey,
  );

  const clientData = new TextEncoder().encode(
    JSON.stringify({ type: "webauthn.create", challenge, origin, crossOrigin: false }),
  );

  return {
    id: b64url(auth.id),
    rawId: b64url(auth.id),
    type: "public-key",
    response: {
      clientDataJSON: b64url(clientData),
      attestationObject: b64url(
        cbor(
          new Map<Cbor, Cbor>([
            ["fmt", "none"],
            ["attStmt", new Map()],
            ["authData", authData],
          ]),
        ),
      ),
      transports: ["internal"],
    },
    clientExtensionResults: {},
  };
}

async function assertion(auth: Authenticator, challenge: string, counter = 1) {
  const authData = concat(
    await sha256(new TextEncoder().encode(RP_ID)),
    new Uint8Array([FLAGS_PRESENT | FLAGS_VERIFIED]),
    new Uint8Array([0, 0, 0, counter]),
  );
  const clientData = new TextEncoder().encode(
    JSON.stringify({ type: "webauthn.get", challenge, origin: ORIGIN, crossOrigin: false }),
  );
  const signed = concat(authData, await sha256(clientData));
  const raw = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, auth.keys.privateKey, signed),
  );

  return {
    id: b64url(auth.id),
    rawId: b64url(auth.id),
    type: "public-key",
    response: {
      clientDataJSON: b64url(clientData),
      authenticatorData: b64url(authData),
      signature: b64url(toDer(raw)),
    },
    clientExtensionResults: {},
  };
}

/* --- HTTP -------------------------------------------------------------------- */

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const send = (method: string, body: unknown, cookie = ""): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

/** Todas las cookies de una respuesta, listas para mandarlas de vuelta. */
const cookiesOf = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");

const join = (...cookies: string[]): string => cookies.filter(Boolean).join("; ");

async function alta(): Promise<string> {
  return cookiesOf(
    await call(
      "/api/auth/register",
      send("POST", { handle: "faku", display_name: "Facundo", password: "una clave larga" }),
    ),
  );
}

/** Agrega una llave a la cuenta de la sesión, como lo haría el navegador. */
async function agregarLlave(session: string, auth: Authenticator): Promise<Response> {
  const options = await call("/api/me/passkeys/options", send("POST", {}, session));
  const { challenge } = (await options.json()) as { challenge: string };
  const response = await attestation(auth, challenge);
  return call(
    "/api/me/passkeys",
    send("POST", { response, name: "Mi teléfono" }, join(session, cookiesOf(options))),
  );
}

async function entrar(): Promise<Response> {
  return call("/api/auth/login", send("POST", { handle: "faku", password: "una clave larga" }));
}

describe("alta de una llave", () => {
  test("se agrega con una firma real y queda en el perfil", async () => {
    const session = await alta();
    const added = await agregarLlave(session, await newAuthenticator());
    expect(added.status).toBe(201);
    expect(((await added.json()) as { name: string }).name).toBe("Mi teléfono");

    const me = (await (await call("/api/me", { headers: { cookie: session } })).json()) as {
      user: { passkeys: number };
    };
    expect(me.user.passkeys).toBe(1);
  });

  test("de la llave se guarda la clave pública y nada más", async () => {
    const session = await alta();
    const auth = await newAuthenticator();
    await agregarLlave(session, auth);

    const row = db()
      .query<Record<string, string | number>, []>("SELECT * FROM user_passkeys")
      .get();
    const jwk = await crypto.subtle.exportKey("jwk", auth.keys.privateKey);
    expect(JSON.stringify(row)).not.toContain(jwk.d ?? "no-hay");
    expect(Object.keys(row ?? {})).not.toContain("last_used");
    expect(String(row?.created_on)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("una firma armada para otro sitio no entra", async () => {
    const session = await alta();
    const options = await call("/api/me/passkeys/options", send("POST", {}, session));
    const { challenge } = (await options.json()) as { challenge: string };
    const response = await attestation(await newAuthenticator(), challenge, "https://jobs.falso");

    const added = await call(
      "/api/me/passkeys",
      send("POST", { response }, join(session, cookiesOf(options))),
    );
    expect(added.status).toBe(422);
  });

  test("sin el desafío que dio el servidor no se agrega nada", async () => {
    const session = await alta();
    await call("/api/me/passkeys/options", send("POST", {}, session));
    const response = await attestation(await newAuthenticator(), b64url(new Uint8Array(32)));
    const added = await call("/api/me/passkeys", send("POST", { response }, session));
    expect(added.status).toBe(422);
  });
});

describe("entrar con la llave", () => {
  test("con llave, la contraseña sola no alcanza, y la firma abre la sesión", async () => {
    const session = await alta();
    const auth = await newAuthenticator();
    await agregarLlave(session, auth);

    const login = await entrar();
    const body = (await login.json()) as {
      status: string;
      options: { challenge: string; allowCredentials: { id: string }[] };
    };
    expect(body.status).toBe("passkey_required");
    expect(body.options.allowCredentials[0]?.id).toBe(b64url(auth.id));
    /** Todavía no hay sesión: solo el desafío. */
    expect(login.headers.getSetCookie().some((c) => c.startsWith("jobit_session="))).toBe(false);

    const signed = await call(
      "/api/auth/passkey",
      send("POST", { response: await assertion(auth, body.options.challenge) }, cookiesOf(login)),
    );
    expect(signed.status).toBe(200);

    const fresh = cookiesOf(signed);
    expect((await call("/api/me", { headers: { cookie: fresh } })).status).toBe(200);
  });

  test("otra llave con el mismo id no entra", async () => {
    const session = await alta();
    const auth = await newAuthenticator();
    await agregarLlave(session, auth);

    const login = await entrar();
    const { options } = (await login.json()) as { options: { challenge: string } };
    const impostor = { ...(await newAuthenticator()), id: auth.id };

    const signed = await call(
      "/api/auth/passkey",
      send("POST", { response: await assertion(impostor, options.challenge) }, cookiesOf(login)),
    );
    expect(signed.status).toBe(401);
  });

  test("una firma no se puede usar dos veces", async () => {
    const session = await alta();
    const auth = await newAuthenticator();
    await agregarLlave(session, auth);

    const login = await entrar();
    const { options } = (await login.json()) as { options: { challenge: string } };
    const payload = send(
      "POST",
      { response: await assertion(auth, options.challenge) },
      cookiesOf(login),
    );

    expect((await call("/api/auth/passkey", payload)).status).toBe(200);
    expect((await call("/api/auth/passkey", payload)).status).toBe(401);
  });

  test("sin la cookie del desafío no hay segundo paso", async () => {
    const session = await alta();
    const auth = await newAuthenticator();
    await agregarLlave(session, auth);

    const { options } = (await (await entrar()).json()) as { options: { challenge: string } };
    const signed = await call(
      "/api/auth/passkey",
      send("POST", { response: await assertion(auth, options.challenge) }),
    );
    expect(signed.status).toBe(401);
  });
});

describe("TOTP de salida", () => {
  test("ya no se puede activar", async () => {
    const session = await alta();
    expect((await call("/api/me/totp", send("POST", {}, session))).status).toBe(410);
  });

  test("agregar una llave borra el secreto TOTP que hubiera", async () => {
    const session = await alta();
    const user = users.byHandle("faku");
    if (!user) throw new Error("sin cuenta");
    await users.setTotpSecret(user.id, "JBSWY3DPEHPK3PXP");
    users.enableTotp(user.id);

    await agregarLlave(session, await newAuthenticator());

    const after = users.byId(user.id);
    expect(after?.totp_enabled).toBe(false);
    expect(after?.totp_secret_enc ?? null).toBeNull();
  });
});

describe("sacar una llave", () => {
  test("pide la contraseña", async () => {
    const session = await alta();
    const auth = await newAuthenticator();
    await agregarLlave(session, auth);
    const id = b64url(auth.id);

    const sin = await call(`/api/me/passkeys/${id}`, send("DELETE", { password: "otra" }, session));
    expect(sin.status).toBe(401);

    const con = await call(
      `/api/me/passkeys/${id}`,
      send("DELETE", { password: "una clave larga" }, session),
    );
    expect(con.status).toBe(200);
    expect((await entrar()).status).toBe(200);
    expect(((await (await entrar()).json()) as { status: string }).status).toBe("ok");
  });
});
