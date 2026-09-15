import { describe, expect, test } from "bun:test";
import { base32Decode, base32Encode, newSecret, otpauthUrl, totpCode, verifyTotp } from "./totp.ts";

/** El secreto de los vectores del RFC 6238: "12345678901234567890" en ASCII. */
const RFC_SECRET = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("base32", () => {
  test("ida y vuelta", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  test("coincide con el ejemplo del RFC 4648", () => {
    expect(base32Encode(new TextEncoder().encode("foobar"))).toBe("MZXW6YTBOI");
  });

  test("tolera espacios y minúsculas, que es como se copia a mano", () => {
    expect(base32Decode("mzxw 6ytb oi")).toEqual(base32Decode("MZXW6YTBOI"));
  });

  test("lo que no es base32 no es un secreto", () => {
    expect(base32Decode("18!!")).toBeNull();
    expect(base32Decode("")).toBeNull();
  });
});

describe("totpCode", () => {
  /** Vectores del apéndice B del RFC 6238, los de SHA-1. */
  test("da los códigos del RFC", async () => {
    expect(await totpCode(RFC_SECRET, new Date(59_000))).toBe("287082");
    expect(await totpCode(RFC_SECRET, new Date(1_111_111_109_000))).toBe("081804");
    expect(await totpCode(RFC_SECRET, new Date(1_234_567_890_000))).toBe("005924");
  });

  test("cambia cada treinta segundos", async () => {
    const now = new Date(1_700_000_000_000);
    const later = new Date(now.getTime() + 30_000);
    expect(await totpCode(RFC_SECRET, now)).not.toBe(await totpCode(RFC_SECRET, later));
  });

  test("un secreto roto no da código", async () => {
    expect(await totpCode("no es base32!", new Date())).toBeNull();
  });
});

describe("verifyTotp", () => {
  const now = new Date(1_700_000_000_000);

  test("acepta el código del momento", async () => {
    const code = await totpCode(RFC_SECRET, now);
    expect(await verifyTotp(RFC_SECRET, code ?? "", now)).toBe(true);
  });

  test("tolera un reloj corrido un paso para cada lado", async () => {
    const antes = await totpCode(RFC_SECRET, now, -1);
    const despues = await totpCode(RFC_SECRET, now, 1);
    expect(await verifyTotp(RFC_SECRET, antes ?? "", now)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, despues ?? "", now)).toBe(true);
  });

  test("dos pasos ya no", async () => {
    const lejos = await totpCode(RFC_SECRET, now, 2);
    expect(await verifyTotp(RFC_SECRET, lejos ?? "", now)).toBe(false);
  });

  test("rechaza lo que no tenga seis dígitos", async () => {
    expect(await verifyTotp(RFC_SECRET, "12345", now)).toBe(false);
    expect(await verifyTotp(RFC_SECRET, "abcdef", now)).toBe(false);
    expect(await verifyTotp(RFC_SECRET, "", now)).toBe(false);
  });

  test("ignora los espacios con los que las apps muestran el código", async () => {
    const code = await totpCode(RFC_SECRET, now);
    expect(await verifyTotp(RFC_SECRET, `${code?.slice(0, 3)} ${code?.slice(3)}`, now)).toBe(true);
  });
});

describe("newSecret", () => {
  test("da 32 caracteres base32 distintos cada vez", () => {
    const a = newSecret();
    expect(a).toHaveLength(32);
    expect(base32Decode(a)).not.toBeNull();
    expect(a).not.toBe(newSecret());
  });
});

describe("otpauthUrl", () => {
  test("lleva el handle y no el correo, que puede no existir", () => {
    const url = otpauthUrl("faku", RFC_SECRET);
    expect(url.startsWith("otpauth://totp/JobIt%3Afaku?")).toBe(true);
    expect(url).toContain(`secret=${RFC_SECRET}`);
    expect(url).toContain("period=30");
  });
});
