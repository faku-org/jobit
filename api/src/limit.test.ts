import { beforeEach, describe, expect, test } from "bun:test";
import { type Limit, clientKey, resetLimits, take } from "./limit.ts";

const LIMIT: Limit = { windowMs: 1000, max: 3 };

beforeEach(resetLimits);

describe("take", () => {
  test("lets the budget through", () => {
    for (let attempt = 0; attempt < LIMIT.max; attempt++) {
      expect(take("a", LIMIT, 0).ok).toBe(true);
    }
  });

  test("refuses what goes over it", () => {
    for (let attempt = 0; attempt < LIMIT.max; attempt++) take("a", LIMIT, 0);
    expect(take("a", LIMIT, 0).ok).toBe(false);
  });

  test("says how long the window has left, never zero", () => {
    for (let attempt = 0; attempt < LIMIT.max; attempt++) take("a", LIMIT, 0);
    expect(take("a", LIMIT, 0).retryAfter).toBe(1);
    expect(take("a", LIMIT, 999).retryAfter).toBe(1);
  });

  test("opens again once the window closes", () => {
    for (let attempt = 0; attempt < LIMIT.max; attempt++) take("a", LIMIT, 0);
    expect(take("a", LIMIT, 0).ok).toBe(false);
    expect(take("a", LIMIT, 1000).ok).toBe(true);
  });

  test("one client running out does not touch another", () => {
    for (let attempt = 0; attempt < LIMIT.max; attempt++) take("a", LIMIT, 0);
    expect(take("a", LIMIT, 0).ok).toBe(false);
    expect(take("b", LIMIT, 0).ok).toBe(true);
  });

  test("reads and writes hold separate budgets for the same address", () => {
    for (let attempt = 0; attempt < LIMIT.max; attempt++) take("r:1.2.3.4", LIMIT, 0);
    expect(take("r:1.2.3.4", LIMIT, 0).ok).toBe(false);
    expect(take("w:1.2.3.4", LIMIT, 0).ok).toBe(true);
  });

  test("survives more clients than it keeps windows for", () => {
    for (let client = 0; client < 12_000; client++) take(`c${client}`, LIMIT, 0);
    expect(take("c11999", LIMIT, 0).ok).toBe(true);
  });
});

const asRequest = (headers: Record<string, string> = {}): Request =>
  new Request("http://localhost/api/jobs", { headers });

describe("clientKey", () => {
  test("takes the socket address when nothing is forwarded", () => {
    expect(clientKey(asRequest(), "10.0.0.9")).toBe("10.0.0.9");
  });

  test("prefers what the proxy forwarded", () => {
    expect(clientKey(asRequest({ "x-forwarded-for": "203.0.113.7" }), "127.0.0.1")).toBe(
      "203.0.113.7",
    );
  });

  test("reads the original client out of a chain of proxies", () => {
    const request = asRequest({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });
    expect(clientKey(request, "127.0.0.1")).toBe("203.0.113.7");
  });

  test("falls back rather than sharing one bucket with an empty header", () => {
    expect(clientKey(asRequest({ "x-forwarded-for": "  " }), "10.0.0.9")).toBe("10.0.0.9");
  });

  test("has a last resort when there is no address at all", () => {
    expect(clientKey(asRequest(), null)).toBe("unknown");
  });
});
