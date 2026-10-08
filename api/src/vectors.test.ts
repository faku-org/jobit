import { describe, expect, test } from "bun:test";
import { EMBEDDING_DIM, cosine, decodeVector, dot, encodeVector, offerText } from "./vectors.ts";

describe("encodeVector / decodeVector", () => {
  test("un vector de 768 dimensiones ocupa 768 * 4 bytes", () => {
    expect(encodeVector(new Float32Array(EMBEDDING_DIM)).byteLength).toBe(EMBEDDING_DIM * 4);
  });

  test("empaqueta little-endian: 1.0 es 00 00 80 3f", () => {
    expect([...encodeVector(Float32Array.from([1]))]).toEqual([0x00, 0x00, 0x80, 0x3f]);
  });

  test("lo que sale vuelve a entrar igual", () => {
    const original = Float32Array.from({ length: EMBEDDING_DIM }, (_, i) => Math.sin(i) * 0.3);
    const decoded = decodeVector(encodeVector(original));
    expect(decoded.length).toBe(EMBEDDING_DIM);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]).toBeCloseTo(original[i] ?? 0, 6);
    }
  });

  test("una cola que no cierra un float no rompe la lectura", () => {
    const bytes = new Uint8Array([...encodeVector(Float32Array.from([1, 2])), 0xff]);
    expect([...decodeVector(bytes)].map((n) => Number(n.toFixed(3)))).toEqual([1, 2]);
  });
});

describe("dot / cosine", () => {
  test("dot suma productos", () => {
    expect(dot(Float32Array.from([1, 2, 3]), Float32Array.from([4, 5, 6]))).toBe(32);
  });

  test("un vector consigo mismo da coseno 1", () => {
    const vector = Float32Array.from([0.3, 0.4, 0.5]);
    expect(cosine(vector, vector)).toBeCloseTo(1, 6);
  });

  test("vectores opuestos dan -1 y ortogonales 0", () => {
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([-1, 0]))).toBeCloseTo(-1, 6);
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([0, 1]))).toBeCloseTo(0, 6);
  });

  test("no depende de que vengan normalizados", () => {
    const cos = cosine(Float32Array.from([2, 2]), Float32Array.from([5, 0]));
    expect(cos).toBeCloseTo(Math.SQRT1_2, 6);
  });

  test("dimensiones distintas o un vector nulo dan 0, sin romper", () => {
    expect(cosine(Float32Array.from([1, 2]), Float32Array.from([1, 2, 3]))).toBe(0);
    expect(cosine(Float32Array.from([0, 0]), Float32Array.from([1, 1]))).toBe(0);
  });
});

describe("offerText", () => {
  test("junta título, descripción y requisitos en ese orden", () => {
    expect(
      offerText({ title: "Diseñador", description: "Producto digital", requirements: "Portfolio" }),
    ).toBe("Diseñador\nProducto digital\nPortfolio");
  });

  test("recorta y saltea lo que viene vacío", () => {
    expect(offerText({ title: "  Diseñador  ", description: "  ", requirements: null })).toBe(
      "Diseñador",
    );
    expect(offerText({})).toBe("");
  });
});
