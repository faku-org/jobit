import { beforeEach, describe, expect, test } from "bun:test";

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
const OTHER_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

const {
  decrypt,
  encrypt,
  encryptionEnabled,
  resetSecretKey,
  sign,
  timingSafeEqual,
  verifySignature,
} = await import("./crypto.ts");

beforeEach(() => {
  process.env.JOBIT_SECRET_KEY = KEY;
  delete process.env.JOBIT_SECRET_KEY_FILE;
  resetSecretKey();
});

describe("encrypt y decrypt", () => {
  test("lo que entra es lo que sale", async () => {
    const result = await encrypt("hola@ejemplo.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const back = await decrypt(result.value);
    expect(back.ok && back.value).toBe("hola@ejemplo.com");
  });

  test("dos cifrados del mismo texto no son iguales", async () => {
    const first = await encrypt("lo mismo");
    const second = await encrypt("lo mismo");
    expect(first.ok && second.ok && first.value !== second.value).toBe(true);
  });

  test("con otra clave no se descifra", async () => {
    const result = await encrypt("un secreto");
    if (!result.ok) return;

    process.env.JOBIT_SECRET_KEY = OTHER_KEY;
    resetSecretKey();

    const back = await decrypt(result.value);
    expect(back.ok).toBe(false);
  });

  test("un dato tocado no descifra", async () => {
    const result = await encrypt("un secreto");
    if (!result.ok) return;

    const tampered = `${result.value.slice(0, -2)}AA`;
    expect((await decrypt(tampered)).ok).toBe(false);
  });

  test("sin clave, cifrar falla cerrado", async () => {
    delete process.env.JOBIT_SECRET_KEY;
    resetSecretKey();

    expect(await encryptionEnabled()).toBe(false);
    expect((await encrypt("algo")).ok).toBe(false);
  });

  test("una clave del largo equivocado no sirve", async () => {
    process.env.JOBIT_SECRET_KEY = Buffer.from("corta").toString("base64url");
    resetSecretKey();
    expect(await encryptionEnabled()).toBe(false);
  });
});

describe("firma", () => {
  test("la firma propia verifica", async () => {
    const signature = await sign("usuario.123");
    expect(signature.ok).toBe(true);
    if (!signature.ok) return;
    expect(await verifySignature("usuario.123", signature.value)).toBe(true);
  });

  test("una firma para otro texto no verifica", async () => {
    const signature = await sign("usuario.123");
    if (!signature.ok) return;
    expect(await verifySignature("usuario.124", signature.value)).toBe(false);
  });

  test("sin clave no hay firma", async () => {
    delete process.env.JOBIT_SECRET_KEY;
    resetSecretKey();
    expect((await sign("x")).ok).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  test("distingue iguales de distintos", () => {
    expect(timingSafeEqual("123456", "123456")).toBe(true);
    expect(timingSafeEqual("123456", "123457")).toBe(false);
    expect(timingSafeEqual("123456", "12345")).toBe(false);
  });
});
