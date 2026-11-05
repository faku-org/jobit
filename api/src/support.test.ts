import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

process.env.DB_FILE = ":memory:";

const { app } = await import("./index.ts");
const { eventsSchema } = await import("./events.ts");
const { supportUrl } = await import("./support.ts");

afterEach(() => {
  delete process.env.SUPPORT_URL;
});

const ask = async (): Promise<unknown> =>
  (await app.handle(new Request("http://localhost/api/support"))).json();

describe("supportUrl", () => {
  test("solo acepta https y sin credenciales", () => {
    expect(supportUrl("https://cafecito.app/jobit")).toBe("https://cafecito.app/jobit");
    expect(supportUrl("http://cafecito.app/jobit")).toBeNull();
    expect(supportUrl("javascript:alert(1)")).toBeNull();
    expect(supportUrl("https://usuario:clave@cafecito.app/jobit")).toBeNull();
    expect(supportUrl("no es una url")).toBeNull();
  });

  test("vacío o sin definir es que no hay enlace", () => {
    expect(supportUrl("")).toBeNull();
    expect(supportUrl("   ")).toBeNull();
    expect(supportUrl(undefined)).toBeNull();
  });
});

describe("GET /api/support", () => {
  test("sin configurar contesta null y la web no muestra el botón", async () => {
    expect(await ask()).toEqual({ url: null });
  });

  test("configurado devuelve el enlace y nada más", async () => {
    process.env.SUPPORT_URL = "https://cafecito.app/jobit";
    expect(await ask()).toEqual({ url: "https://cafecito.app/jobit" });
  });

  test("no pide cuenta ni deja cookie", async () => {
    process.env.SUPPORT_URL = "https://cafecito.app/jobit";
    const response = await app.handle(new Request("http://localhost/api/support"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("sin contraprestación y sin seguimiento", () => {
  test("no existe un evento de apoyo: abrir el enlace no se cuenta", () => {
    const kinds = JSON.stringify(eventsSchema);
    expect(kinds.toLowerCase()).not.toContain("support");
    expect(kinds.toLowerCase()).not.toContain("apoyo");
  });

  test("el archivo no depende de servicios, cuentas ni destacados", () => {
    const source = readFileSync(join(import.meta.dir, "support.ts"), "utf8");
    const imports = source.split("\n").filter((line) => line.startsWith("import"));

    expect(imports).toEqual(['import { Elysia } from "elysia";']);
  });
});
