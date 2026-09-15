import { beforeEach, describe, expect, test } from "bun:test";

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");

const { accountsEnabled, open, resetSecretsCache, seal } = await import("./secrets.ts");

beforeEach(() => {
  resetSecretsCache();
  process.env.ACCOUNT_KEY = KEY;
  delete process.env.ACCOUNT_KEY_FILE;
});

describe("accountsEnabled", () => {
  test("apagado sin clave, que es como tiene que fallar", () => {
    delete process.env.ACCOUNT_KEY;
    expect(accountsEnabled()).toBe(false);
  });

  test("media clave no es una clave", () => {
    process.env.ACCOUNT_KEY = Buffer.from(new Uint8Array(16)).toString("base64");
    expect(accountsEnabled()).toBe(false);
  });

  test("encendido con 32 bytes en base64", () => {
    expect(accountsEnabled()).toBe(true);
  });
});

describe("seal / open", () => {
  test("ida y vuelta", async () => {
    const sealed = await seal("faku@example.com");
    expect(await open(sealed)).toBe("faku@example.com");
  });

  test("el texto cifrado no contiene el original", async () => {
    expect(await seal("faku@example.com")).not.toContain("faku");
  });

  test("dos cifrados del mismo texto no son iguales", async () => {
    expect(await seal("hola")).not.toBe(await seal("hola"));
  });

  test("lo vacío queda vacío y no ocupa una fila cifrada", async () => {
    expect(await seal("")).toBe("");
    expect(await open("")).toBeNull();
  });

  test("un byte cambiado no descifra: GCM autentica lo que guarda", async () => {
    const sealed = await seal("hola");
    const parts = sealed.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${(parts[2] ?? "").slice(0, -2)}AA`;
    expect(await open(tampered)).toBeNull();
  });

  test("otra clave no abre lo de esta", async () => {
    const sealed = await seal("hola");
    process.env.ACCOUNT_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
      "base64",
    );
    expect(await open(sealed)).toBeNull();
  });

  test("sin clave no se puede cifrar, y se dice", async () => {
    delete process.env.ACCOUNT_KEY;
    expect(seal("hola")).rejects.toThrow();
  });
});
