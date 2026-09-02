import { describe, expect, test } from "bun:test";
import { embedRequest, sharedJobId } from "./share.ts";

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
});
