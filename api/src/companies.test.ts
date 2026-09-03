import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";

const { closeDb } = await import("./db.ts");
const { byId, counts, create, list, remove, slugify, update } = await import("./companies.ts");

beforeEach(closeDb);

describe("slugify", () => {
  test("saca acentos y puntuación", () => {
    expect(slugify("Frigorífico Ñandú S.A.")).toBe("frigorifico-nandu-s-a");
  });

  test("no deja guiones colgando en las puntas", () => {
    expect(slugify("  ¡Acme!  ")).toBe("acme");
  });

  test("sobrevive a un nombre sin una sola letra", () => {
    expect(slugify("¿¡!?")).toBe("");
  });
});

describe("create", () => {
  test("nace pendiente de aprobación", () => {
    const result = create({ name: "Acme" });
    expect(result.ok && result.value.status).toBe("pending");
  });

  test("exige un nombre", () => {
    const result = create({ name: "   " });
    expect(result.ok).toBe(false);
  });

  test("dos empresas homónimas no se pisan el slug", () => {
    const first = create({ name: "Acme" });
    const second = create({ name: "Acme" });
    expect(first.ok && first.value.slug).toBe("acme");
    expect(second.ok && second.value.slug).toBe("acme-2");
  });

  test("rechaza un sitio que no sea http o https", () => {
    const result = create({ name: "Acme", website: "javascript:alert(1)" });
    expect(result.ok).toBe(false);
  });

  test("acepta un sitio normal y lo normaliza", () => {
    const result = create({ name: "Acme", website: "https://acme.com" });
    expect(result.ok && result.value.website).toBe("https://acme.com/");
  });

  test("rechaza un correo que no lo parece", () => {
    expect(create({ name: "Acme", email: "no-es-un-correo" }).ok).toBe(false);
  });

  test("guarda el correo en minúsculas", () => {
    const result = create({ name: "Acme", email: "RRHH@Acme.com" });
    expect(result.ok && result.value.email).toBe("rrhh@acme.com");
  });
});

describe("update", () => {
  test("cambia el estado", () => {
    const created = create({ name: "Acme" });
    if (!created.ok) throw new Error("no se creó");

    const updated = update(created.value.id, { status: "approved" });
    expect(updated.ok && updated.value.status).toBe("approved");
  });

  test("el slug sigue al nombre", () => {
    const created = create({ name: "Acme" });
    if (!created.ok) throw new Error("no se creó");

    const updated = update(created.value.id, { name: "Beta" });
    expect(updated.ok && updated.value.slug).toBe("beta");
  });

  test("renombrar a lo mismo no le agrega un sufijo al slug", () => {
    const created = create({ name: "Acme" });
    if (!created.ok) throw new Error("no se creó");

    const updated = update(created.value.id, { name: "Acme", notes: "al día" });
    expect(updated.ok && updated.value.slug).toBe("acme");
  });

  test("lo que no se manda queda como estaba", () => {
    const created = create({ name: "Acme", email: "rrhh@acme.com" });
    if (!created.ok) throw new Error("no se creó");

    const updated = update(created.value.id, { notes: "llamar el lunes" });
    expect(updated.ok && updated.value.email).toBe("rrhh@acme.com");
  });

  test("una empresa que no existe no se actualiza", () => {
    expect(update("no-existe", { name: "Acme" }).ok).toBe(false);
  });
});

describe("list", () => {
  test("las pendientes van primero, que son las que piden acción", () => {
    create({ name: "Zulu", status: "approved" });
    create({ name: "Alfa", status: "pending" });

    expect(list().map((company) => company.name)).toEqual(["Alfa", "Zulu"]);
  });

  test("filtra por estado", () => {
    create({ name: "Zulu", status: "approved" });
    create({ name: "Alfa", status: "pending" });

    expect(list({ status: "approved" }).map((company) => company.name)).toEqual(["Zulu"]);
  });

  test("busca por nombre y por correo", () => {
    create({ name: "Acme", email: "rrhh@acme.com" });
    create({ name: "Beta" });

    expect(list({ q: "acme" }).map((company) => company.name)).toEqual(["Acme"]);
    expect(list({ q: "rrhh@" }).map((company) => company.name)).toEqual(["Acme"]);
  });
});

describe("counts y remove", () => {
  test("cuenta por estado", () => {
    create({ name: "Alfa", status: "pending" });
    create({ name: "Beta", status: "approved" });
    create({ name: "Gama", status: "approved" });

    expect(counts()).toEqual({ pending: 1, approved: 2, suspended: 0 });
  });

  test("borrar saca la fila y avisa si no había nada", () => {
    const created = create({ name: "Acme" });
    if (!created.ok) throw new Error("no se creó");

    expect(remove(created.value.id)).toBe(true);
    expect(byId(created.value.id)).toBeNull();
    expect(remove(created.value.id)).toBe(false);
  });
});
