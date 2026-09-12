import { describe, expect, test } from "bun:test";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUrl,
  totpCode,
  totpValid,
} from "./totp.ts";

/** El secreto de los vectores de prueba del RFC 6238: "12345678901234567890". */
const RFC_SECRET = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("base32", () => {
  test("ida y vuelta deja los mismos bytes", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  test("tolera espacios, guiones y minúsculas, que es como se copia a mano", () => {
    const encoded = base32Encode(new TextEncoder().encode("hola"));
    expect(base32Decode(encoded.toLowerCase().replace(/(.{4})/g, "$1 "))).toEqual(
      base32Decode(encoded),
    );
  });

  test("lo que no es base32 no se decodifica", () => {
    expect(base32Decode("1888!!")).toBeNull();
    expect(base32Decode("")).toBeNull();
  });
});

describe("totpCode", () => {
  /** Los vectores del RFC vienen de ocho dígitos; acá se usan seis. */
  test("coincide con los vectores del RFC 6238", async () => {
    expect(await totpCode(RFC_SECRET, new Date(59_000))).toBe("287082");
    expect(await totpCode(RFC_SECRET, new Date(1_111_111_109_000))).toBe("081804");
    expect(await totpCode(RFC_SECRET, new Date(1_234_567_890_000))).toBe("005924");
  });

  test("el código cambia con el paso de treinta segundos", async () => {
    const secret = generateTotpSecret();
    const primero = await totpCode(secret, new Date(0));
    const siguiente = await totpCode(secret, new Date(30_000));
    expect(primero).not.toBe(siguiente);
  });

  test("un secreto que no es base32 no genera nada", async () => {
    expect(await totpCode("no es un secreto!", new Date())).toBeNull();
  });
});

describe("totpValid", () => {
  const at = new Date(1_700_000_000_000);

  test("acepta el código del momento", async () => {
    const secret = generateTotpSecret();
    const code = await totpCode(secret, at);
    expect(await totpValid(secret, code ?? "", at)).toBe(true);
  });

  test("tolera un paso de reloj corrido para cada lado", async () => {
    const secret = generateTotpSecret();
    const anterior = await totpCode(secret, new Date(at.getTime() - 30_000));
    const posterior = await totpCode(secret, new Date(at.getTime() + 30_000));

    expect(await totpValid(secret, anterior ?? "", at)).toBe(true);
    expect(await totpValid(secret, posterior ?? "", at)).toBe(true);
  });

  test("dos pasos ya es demasiado", async () => {
    const secret = generateTotpSecret();
    const viejo = await totpCode(secret, new Date(at.getTime() - 90_000));
    expect(await totpValid(secret, viejo ?? "", at)).toBe(false);
  });

  test("rechaza lo que no son seis dígitos", async () => {
    const secret = generateTotpSecret();
    expect(await totpValid(secret, "12345", at)).toBe(false);
    expect(await totpValid(secret, "abcdef", at)).toBe(false);
    expect(await totpValid(secret, "", at)).toBe(false);
  });

  test("el código de otro secreto no entra", async () => {
    const code = await totpCode(generateTotpSecret(), at);
    expect(await totpValid(generateTotpSecret(), code ?? "", at)).toBe(false);
  });
});

describe("otpauthUrl", () => {
  test("lleva el secreto, el emisor y los parámetros que lee la app", () => {
    const url = new URL(otpauthUrl("ABCDEF", "juana"));
    expect(url.protocol).toBe("otpauth:");
    expect(decodeURIComponent(url.pathname)).toContain("JobIt:juana");
    expect(url.searchParams.get("secret")).toBe("ABCDEF");
    expect(url.searchParams.get("digits")).toBe("6");
    expect(url.searchParams.get("period")).toBe("30");
  });

  test("un handle con caracteres raros no rompe la URL", () => {
    const url = otpauthUrl("ABCDEF", "juana/martínez?x=1");
    expect(() => new URL(url)).not.toThrow();
    expect(url).not.toContain("?x=1");
  });
});
