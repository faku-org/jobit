import { describe, expect, test } from "bun:test";

const { challengeName, challengeValue, hasRecord, hostnameOf, mintToken } = await import(
  "./website.ts"
);

describe("hostnameOf", () => {
  test("saca el host de una URL", () => {
    expect(hostnameOf("https://www.Acme.com/empleos")).toBe("www.acme.com");
  });

  test("una cosa que no es URL no tiene host", () => {
    expect(hostnameOf("no es una url")).toBeNull();
    expect(hostnameOf("")).toBeNull();
  });
});

describe("el registro", () => {
  test("el nombre cuelga del dominio y el valor lleva el token", () => {
    expect(challengeName("acme.com")).toBe("_jobit.acme.com");
    expect(challengeValue("abc")).toBe("jobit-verify=abc");
  });

  test("cada token es distinto", () => {
    expect(mintToken()).not.toBe(mintToken());
  });
});

describe("hasRecord", () => {
  test("verifica cuando el TXT está y consulta el nombre correcto", async () => {
    const seen: string[] = [];
    const resolver = async (name: string): Promise<string[][]> => {
      seen.push(name);
      return [["jobit-verify=abc"]];
    };

    expect(await hasRecord("acme.com", "abc", resolver)).toBe(true);
    expect(seen).toEqual(["_jobit.acme.com"]);
  });

  test("une los trozos en que DNS parte el TXT", async () => {
    const resolver = async (): Promise<string[][]> => [["jobit-verify=", "abc"]];
    expect(await hasRecord("acme.com", "abc", resolver)).toBe(true);
  });

  test("otro registro no alcanza", async () => {
    const resolver = async (): Promise<string[][]> => [["google-site-verification=xyz"]];
    expect(await hasRecord("acme.com", "abc", resolver)).toBe(false);
  });

  test("un resolver que falla no rompe: no verificado", async () => {
    const resolver = async (): Promise<string[][]> => {
      throw new Error("NXDOMAIN");
    };
    expect(await hasRecord("acme.com", "abc", resolver)).toBe(false);
  });

  test("sin dominio o sin token no verifica", async () => {
    const resolver = async (): Promise<string[][]> => [["jobit-verify=abc"]];
    expect(await hasRecord("", "abc", resolver)).toBe(false);
    expect(await hasRecord("acme.com", "", resolver)).toBe(false);
  });
});
