import { describe, expect, test } from "bun:test";
import { embedRequest, embedServiceRequest, sharedJobId, sharedServiceSlug } from "./share.ts";

describe("sharedJobId", () => {
  test("reads the offer a shared link points at", () => {
    expect(sharedJobId("?job=abc123")).toBe("abc123");
  });

  test("is null without the parameter", () => {
    expect(sharedJobId("?q=cocina")).toBeNull();
  });
});

describe("embedRequest", () => {
  test("is null on a normal visit", () => {
    expect(embedRequest("?job=abc123")).toBeNull();
  });

  test("follows the browser scheme by default", () => {
    expect(embedRequest("?embed=abc123")).toEqual({ id: "abc123", theme: "system" });
  });

  test("takes the scheme the host page pins", () => {
    expect(embedRequest("?embed=abc123&theme=dark")).toEqual({ id: "abc123", theme: "dark" });
  });

  test("ignores a scheme that is not one of ours", () => {
    expect(embedRequest("?embed=abc123&theme=neon")?.theme).toBe("system");
  });

  test("un servicio no es una oferta: el embed de ofertas no lo toma", () => {
    expect(embedRequest("?embed_service=electricista")).toBeNull();
  });
});

describe("sharedServiceSlug", () => {
  test("lee el servicio al que apunta un enlace compartido", () => {
    expect(sharedServiceSlug("?service=electricista")).toBe("electricista");
  });

  test("es null sin el parámetro", () => {
    expect(sharedServiceSlug("?job=abc123")).toBeNull();
  });
});

describe("embedServiceRequest", () => {
  test("es null en una visita normal", () => {
    expect(embedServiceRequest("?service=electricista")).toBeNull();
  });

  test("toma el mismo tema que el embed de ofertas", () => {
    expect(embedServiceRequest("?embed_service=electricista&theme=dark")).toEqual({
      slug: "electricista",
      theme: "dark",
    });
  });
});
