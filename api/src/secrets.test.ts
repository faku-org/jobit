import { beforeEach, describe, expect, test } from "bun:test";
import { decryptSecret, encryptSecret, secretsEnabled } from "./secrets.ts";

beforeEach(() => {
  process.env.USER_SECRET_KEY = "una clave de prueba, larga y sin gracia";
  delete process.env.USER_SECRET_KEY_FILE;
});

describe("sin clave", () => {
  test("no cifra ni descifra, en vez de guardar en claro", async () => {
    delete process.env.USER_SECRET_KEY;

    expect(secretsEnabled()).toBe(false);
    expect(await encryptSecret("juana@ejemplo.com")).toBeNull();
    expect(await decryptSecret("v1.abc.def")).toBeNull();
  });

  test("una clave vacía es no tener clave", () => {
    process.env.USER_SECRET_KEY = "   ";
    expect(secretsEnabled()).toBe(false);
  });
});

describe("con clave", () => {
  test("ida y vuelta devuelve lo mismo", async () => {
    const sealed = await encryptSecret("juana@ejemplo.com");
    expect(sealed).toStartWith("v1.");
    expect(sealed).not.toContain("juana");
    expect(await decryptSecret(sealed ?? "")).toBe("juana@ejemplo.com");
  });

  test("el mismo texto no da dos veces lo mismo", async () => {
    expect(await encryptSecret("hola")).not.toBe(await encryptSecret("hola"));
  });

  test("una fila tocada a mano no se descifra", async () => {
    const sealed = (await encryptSecret("juana@ejemplo.com")) ?? "";
    const [version, iv, payload] = sealed.split(".");
    const roto = `${version}.${iv}.${(payload ?? "").slice(0, -2)}xy`;

    expect(await decryptSecret(roto)).toBeNull();
  });

  test("lo que no tiene la forma esperada tampoco", async () => {
    expect(await decryptSecret("")).toBeNull();
    expect(await decryptSecret("v2.abc.def")).toBeNull();
    expect(await decryptSecret("cualquier cosa")).toBeNull();
  });

  test("otra clave no abre lo de la primera", async () => {
    const sealed = (await encryptSecret("juana@ejemplo.com")) ?? "";

    process.env.USER_SECRET_KEY = "otra clave distinta, igual de larga";
    expect(await decryptSecret(sealed)).toBeNull();
  });

  test("el archivo le gana a la variable", async () => {
    const path = `${import.meta.dir}/../../data/test-user-key.txt`;
    const { writeFileSync, mkdirSync, rmSync } = await import("node:fs");

    mkdirSync(`${import.meta.dir}/../../data`, { recursive: true });
    /* Con salto de línea al final, que es como lo deja cualquier editor. */
    writeFileSync(path, "la clave del archivo, bien larga\n", "utf8");

    try {
      process.env.USER_SECRET_KEY_FILE = path;
      const sealed = (await encryptSecret("hola")) ?? "";

      delete process.env.USER_SECRET_KEY_FILE;
      expect(await decryptSecret(sealed)).toBeNull();
    } finally {
      rmSync(path, { force: true });
    }
  });
});
