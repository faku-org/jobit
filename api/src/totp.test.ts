import { describe, expect, test } from "bun:test";
import { base32Decode, base32Encode, generateSecret, otpauthUrl, totp, verifyTotp } from "./totp.ts";

/** El secreto de prueba del RFC 6238: el ASCII "12345678901234567890". */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("base32", () => {
  test("ida y vuelta", () => {
    const bytes = new TextEncoder().encode("12345678901234567890");
    expect(base32Encode(bytes)).toBe(RFC_SECRET);
    expect(base32Decode(RFC_SECRET)).toEqual(bytes);
  });

  test("un texto que no es base32 no decodifica", () => {
    expect(base32Decode("¡no!")).toBeNull();
  });
});

describe("totp contra los vectores del RFC 6238", () => {
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1_111_111_109, "07081804"],
    [1_111_111_111, "14050471"],
    [1_234_567_890, "89005924"],
    [2_000_000_000, "69279037"],
    [20_000_000_000, "65353130"],
  ];

  for (const [seconds, code] of vectors) {
    test(`a los ${seconds} segundos da ${code}`, async () => {
      expect(await totp(RFC_SECRET, seconds * 1000, 8)).toBe(code);
    });
  }
});

describe("verifyTotp", () => {
  test("acepta el código del momento", async () => {
    const secret = generateSecret();
    const code = await totp(secret);
    expect(code).not.toBeNull();
    if (!code) return;
    expect((await verifyTotp(secret, code)).ok).toBe(true);
  });

  test("tolera un paso de reloj corrido", async () => {
    const secret = generateSecret();
    const at = Date.now();
    const before = await totp(secret, at - 30_000);
    if (!before) return;
    expect((await verifyTotp(secret, before, at)).ok).toBe(true);
  });

  test("no tolera dos pasos", async () => {
    const secret = generateSecret();
    const at = Date.now();
    const old = await totp(secret, at - 90_000);
    if (!old) return;
    expect((await verifyTotp(secret, old, at)).ok).toBe(false);
  });

  test("un código de otro secreto no entra", async () => {
    const code = await totp(generateSecret());
    if (!code) return;
    expect((await verifyTotp(generateSecret(), code)).ok).toBe(false);
  });

  test("lo que no tiene seis dígitos no se prueba", async () => {
    const secret = generateSecret();
    expect((await verifyTotp(secret, "12345")).ok).toBe(false);
    expect((await verifyTotp(secret, "abcdef")).ok).toBe(false);
    expect((await verifyTotp(secret, "")).ok).toBe(false);
  });

  test("acepta el código con espacios de más", async () => {
    const secret = generateSecret();
    const code = await totp(secret);
    if (!code) return;
    expect((await verifyTotp(secret, ` ${code} `)).ok).toBe(true);
  });
});

describe("otpauthUrl", () => {
  test("arma la uri que el cliente convierte en QR", () => {
    const url = otpauthUrl({ secret: RFC_SECRET, account: "faku", issuer: "JobIt" });
    expect(url.startsWith("otpauth://totp/JobIt:faku?")).toBe(true);
    expect(url).toContain(`secret=${RFC_SECRET}`);
    expect(url).toContain("issuer=JobIt");
    expect(url).toContain("digits=6");
  });
});
