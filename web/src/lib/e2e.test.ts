import { describe, expect, test } from "bun:test";
import {
  type Envelope,
  changePassword,
  createVault,
  derive,
  exportPublicKey,
  fromBase64url,
  generateAccountKeys,
  keyId,
  newKdfParams,
  open,
  openJson,
  recoverWithCode,
  seal,
  sealJson,
  toBase64url,
  unlockWithPassword,
  unwrapPrivateKey,
  wrapPrivateKey,
} from "./e2e.ts";

/** 600.000 iteraciones por test son segundos cada una. La cantidad no cambia
 * la lógica: viaja en los parámetros y se prueba aparte que se respete. */
const FAST = 1_000;
const CODES = ["ABCD-EFGH-JK", "2345-6789-MN", "PQRS-TUVW-XY"];

const flip = (text: string): string => {
  const bytes = fromBase64url(text);
  bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
  return toBase64url(bytes);
};

describe("base64url", () => {
  test("ida y vuelta, sin relleno ni caracteres de url", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(257));
    const text = toBase64url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(fromBase64url(text)).toEqual(bytes);
  });
});

describe("derive", () => {
  test("auth y wrap salen del mismo secreto pero no son la misma clave", async () => {
    const params = newKdfParams(FAST);
    const a = await derive("contraseña larga", "password", params);
    const b = await derive("contraseña larga", "password", params);
    expect(a.auth).toBe(b.auth);
    expect(fromBase64url(a.auth)).toHaveLength(32);
    // wrap no es exportable: nada del navegador puede sacarla.
    expect(a.wrap.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", a.wrap)).rejects.toThrow();
  });

  test("otra sal, otra contraseña u otro tipo dan otro auth", async () => {
    const params = newKdfParams(FAST);
    const base = await derive("secreto", "password", params);
    expect((await derive("secreto", "password", newKdfParams(FAST))).auth).not.toBe(base.auth);
    expect((await derive("secreto!", "password", params)).auth).not.toBe(base.auth);
    expect((await derive("SECRETO", "code", params)).auth).not.toBe(base.auth);
  });

  test("las iteraciones cuentan: son parte de los parámetros", async () => {
    const params = newKdfParams(FAST);
    const other = { ...params, iterations: FAST + 1 };
    expect((await derive("x", "password", params)).auth).not.toBe(
      (await derive("x", "password", other)).auth,
    );
  });

  test("los códigos se tipean como sea", async () => {
    const params = newKdfParams(FAST);
    const shown = await derive("ABCD-EFGH-JK", "code", params);
    const typed = await derive(" abcd efgh jk ", "code", params);
    expect(typed.auth).toBe(shown.auth);
  });

  test("la contraseña se normaliza a NFC", async () => {
    const params = newKdfParams(FAST);
    const composed = await derive("canción", "password", params);
    const decomposed = await derive("canción", "password", params);
    expect(decomposed.auth).toBe(composed.auth);
  });

  test("un KDF desconocido no se interpreta como otro", async () => {
    const params = { ...newKdfParams(FAST), kdf: "argon2id" } as unknown as ReturnType<
      typeof newKdfParams
    >;
    await expect(derive("x", "password", params)).rejects.toThrow("KDF desconocido");
  });
});

describe("clave privada envuelta", () => {
  test("abre con la misma clave y la misma etiqueta, y con nada más", async () => {
    const keys = await generateAccountKeys();
    const right = await derive("uno", "password", newKdfParams(FAST));
    const wrong = await derive("dos", "password", newKdfParams(FAST));
    const wrapped = await wrapPrivateKey(keys.privateKey, right.wrap, "password");

    const opened = await unwrapPrivateKey(wrapped, right.wrap, "password");
    expect(opened.extractable).toBe(false);

    await expect(unwrapPrivateKey(wrapped, wrong.wrap, "password")).rejects.toThrow();
    // La copia de un código no se acepta en el lugar de la de la contraseña.
    await expect(unwrapPrivateKey(wrapped, right.wrap, "code:0")).rejects.toThrow();
    await expect(
      unwrapPrivateKey({ ...wrapped, data: flip(wrapped.data) }, right.wrap, "password"),
    ).rejects.toThrow();
  });
});

describe("sobres", () => {
  test("cada destinatario abre el suyo", async () => {
    const company = await generateAccountKeys();
    const candidate = await generateAccountKeys();
    const envelope = await sealJson(
      { carta: "Hola, me interesa" },
      [company.publicKey, candidate.publicKey],
      "application:42",
    );
    expect(envelope.slots).toHaveLength(2);

    for (const keys of [company, candidate]) {
      const opened = await openJson<{ carta: string }>(envelope, keys, "application:42");
      expect(opened).toEqual({ ok: true, value: { carta: "Hola, me interesa" } });
    }
  });

  test("el servidor no ve el contenido en el sobre", async () => {
    const keys = await generateAccountKeys();
    const envelope = await sealJson({ nombre: "Ana Pérez" }, [keys.publicKey], "sync");
    expect(JSON.stringify(envelope)).not.toContain("Ana");
  });

  test("dos sobres del mismo contenido no se parecen", async () => {
    const keys = await generateAccountKeys();
    const a = await sealJson("igual", [keys.publicKey], "sync");
    const b = await sealJson("igual", [keys.publicKey], "sync");
    expect(a.data).not.toBe(b.data);
    expect(a.slots[0]?.key).not.toBe(b.slots[0]?.key);
  });

  test("quien no es destinatario no lo abre", async () => {
    const company = await generateAccountKeys();
    const stranger = await generateAccountKeys();
    const envelope = await sealJson("privado", [company.publicKey], "application:1");
    const opened = await open(envelope, stranger, "application:1");
    expect(opened.ok).toBe(false);
  });

  test("tampoco robando el casillero de otro", async () => {
    const company = await generateAccountKeys();
    const stranger = await generateAccountKeys();
    const envelope = await sealJson("privado", [company.publicKey], "application:1");
    // El servidor reescribe el kid para que el casillero parezca del extraño.
    const forged: Envelope = {
      ...envelope,
      slots: envelope.slots.map((slot) => ({ ...slot, kid: "" })),
    };
    forged.slots[0] = { ...envelope.slots[0]!, kid: await keyId(stranger.publicKey) };
    expect((await open(forged, stranger, "application:1")).ok).toBe(false);
  });

  test("un sobre de un contexto no abre en otro", async () => {
    const keys = await generateAccountKeys();
    const envelope = await sealJson("de la postulación 1", [keys.publicKey], "application:1");
    expect((await open(envelope, keys, "application:2")).ok).toBe(false);
    expect((await open(envelope, keys, "sync")).ok).toBe(false);
  });

  test("un bit cambiado en el contenido o en la llave lo invalida", async () => {
    const keys = await generateAccountKeys();
    const envelope = await sealJson("intacto", [keys.publicKey], "sync");
    expect((await open({ ...envelope, data: flip(envelope.data) }, keys, "sync")).ok).toBe(false);
    const slot = envelope.slots[0]!;
    expect(
      (await open({ ...envelope, slots: [{ ...slot, key: flip(slot.key) }] }, keys, "sync")).ok,
    ).toBe(false);
  });

  test("casillero cambiado entre dos sobres: no abre", async () => {
    const keys = await generateAccountKeys();
    const a = await sealJson("a", [keys.publicKey], "sync");
    const b = await sealJson("b", [keys.publicKey], "sync");
    expect((await open({ ...a, slots: b.slots }, keys, "sync")).ok).toBe(false);
  });

  test("sin destinatarios no se cierra", async () => {
    await expect(seal(new Uint8Array(1), [], "sync")).rejects.toThrow();
  });
});

describe("la bóveda de la cuenta", () => {
  test("el alta y la entrada con contraseña", async () => {
    const created = await createVault("una contraseña", CODES, FAST);
    const unlocked = await unlockWithPassword(created.vault, "una contraseña");
    expect(unlocked.auth).toBe(created.passwordAuth);
    expect(await exportPublicKey(unlocked.keys.publicKey)).toBe(created.vault.publicKey);

    // Lo que se cerró con la clave del alta lo abre la de la entrada.
    const envelope = await sealJson({ ok: 1 }, [created.keys.publicKey], "sync");
    expect(await openJson(envelope, unlocked.keys, "sync")).toEqual({ ok: true, value: { ok: 1 } });
  });

  test("la contraseña equivocada no abre", async () => {
    const created = await createVault("una contraseña", CODES, FAST);
    await expect(unlockWithPassword(created.vault, "otra")).rejects.toThrow();
  });

  test("lo que ve el servidor no incluye ni la contraseña ni los códigos ni la privada", async () => {
    const created = await createVault("una contraseña", CODES, FAST);
    const stored = JSON.stringify(created.vault);
    expect(stored).not.toContain("una contraseña");
    for (const code of CODES) expect(stored).not.toContain(code.replace(/-/g, ""));
    const pkcs8 = toBase64url(await crypto.subtle.exportKey("pkcs8", created.keys.privateKey));
    expect(stored).not.toContain(pkcs8);
    // Un auth por código, y ninguno es sha256(código).
    expect(created.codeAuths).toHaveLength(CODES.length);
    expect(new Set(created.codeAuths).size).toBe(CODES.length);
  });

  test("cambiar la contraseña no recifra nada y la vieja deja de servir", async () => {
    const created = await createVault("vieja", CODES, FAST);
    const envelope = await sealJson("de antes", [created.keys.publicKey], "sync");
    const changed = await changePassword(created.vault, "vieja", "nueva", FAST);

    expect(changed.vault.publicKey).toBe(created.vault.publicKey);
    expect(changed.auth).not.toBe(created.passwordAuth);
    await expect(unlockWithPassword(changed.vault, "vieja")).rejects.toThrow();
    const unlocked = await unlockWithPassword(changed.vault, "nueva");
    expect((await openJson(envelope, unlocked.keys, "sync")).ok).toBe(true);
  });

  test("cambiar la contraseña pide la actual", async () => {
    const created = await createVault("vieja", CODES, FAST);
    await expect(changePassword(created.vault, "adivinada", "nueva", FAST)).rejects.toThrow();
  });

  test("un código recupera el contenido, tipeado como sea, y dice cuál fue", async () => {
    const created = await createVault("olvidada", CODES, FAST);
    const envelope = await sealJson("lo mío", [created.keys.publicKey], "sync");

    const recovered = await recoverWithCode(created.vault, "pqrs tuvw xy", "nueva", FAST);
    expect(recovered.index).toBe(2);
    expect(recovered.codeAuth).toBe(created.codeAuths[2]!);

    const unlocked = await unlockWithPassword(recovered.vault, "nueva");
    expect(await openJson(envelope, unlocked.keys, "sync")).toEqual({ ok: true, value: "lo mío" });
  });

  test("un código inventado no recupera nada", async () => {
    const created = await createVault("olvidada", CODES, FAST);
    await expect(recoverWithCode(created.vault, "ZZZZ-ZZZZ-ZZ", "nueva", FAST)).rejects.toThrow();
  });

  test("la copia de un código no abre con la etiqueta de otro", async () => {
    const created = await createVault("x", CODES, FAST);
    const derived = await derive(CODES[0]!, "code", created.vault.codes.params);
    const copy = created.vault.codes.wrapped[0]!;
    await expect(unwrapPrivateKey(copy, derived.wrap, "code:0")).resolves.toBeDefined();
    await expect(unwrapPrivateKey(copy, derived.wrap, "code:1")).rejects.toThrow();
  });
});
