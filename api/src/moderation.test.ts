import { describe, expect, test } from "bun:test";
import {
  type Print,
  type ServiceText,
  coherence,
  duplicates,
  heuristics,
  minhash,
  review,
  shingles,
  similarity,
  textHash,
} from "./moderation.ts";

const LIMPIO: ServiceText = {
  title: "Electricista a domicilio",
  summary: "Instalaciones y arreglos",
  description:
    "Hago instalaciones eléctricas en casas y locales: tableros, tomas, luces y " +
    "cambios de instalación vieja. Trabajo en Canelones y Montevideo, con " +
    "presupuesto antes de empezar y garantía por escrito sobre lo que instalo.",
  category: "oficios",
  skills: ["Tableros", "Luminarias"],
};

const con = (extra: Partial<ServiceText>): ServiceText => ({ ...LIMPIO, ...extra });

const codes = (signals: { code: string }[]): string[] => signals.map((signal) => signal.code);

describe("heurísticas", () => {
  test("un servicio bien escrito no levanta nada", () => {
    expect(heuristics(LIMPIO)).toEqual([]);
  });

  test("el teléfono va en su campo y no en el texto", () => {
    expect(
      codes(heuristics(con({ description: `${LIMPIO.description} Llamame al 099 123 456` }))),
    ).toContain("telefono");
  });

  test("el correo tampoco va adentro", () => {
    expect(
      codes(
        heuristics(con({ description: `${LIMPIO.description} escribime a juana@ejemplo.com` })),
      ),
    ).toContain("correo");
  });

  test("los enlaces de afuera se marcan y los de trabajo mostrado no", () => {
    expect(
      codes(
        heuristics(
          con({ description: `${LIMPIO.description} https://comprabarato.example/oferta` }),
        ),
      ),
    ).toContain("enlace");

    expect(
      codes(heuristics(con({ description: `${LIMPIO.description} https://github.com/juana` }))),
    ).not.toContain("enlace");
  });

  test("gritar se nota", () => {
    expect(
      codes(heuristics(con({ description: "ELECTRICISTA URGENTE LLAME YA MISMO AHORA MISMO" }))),
    ).toContain("mayusculas");
  });

  test("la misma frase repetida también", () => {
    const frase = "Trabajo en casas y locales de todo tipo.";
    expect(codes(heuristics(con({ description: `${frase} ${frase} ${frase}` })))).toContain(
      "repeticion",
    );
  });

  test("una descripción que no dice nada y un servicio sin habilidades suben", () => {
    const señales = codes(heuristics(con({ description: "Hago cosas", skills: [] })));
    expect(señales).toContain("corto");
    expect(señales).toContain("sin-habilidades");
  });
});

describe("similitud", () => {
  test("el mismo texto da la misma firma", () => {
    expect(minhash("hola que tal como andas")).toBe(minhash("hola que tal como andas"));
  });

  test("dos textos parecidos se parecen y dos distintos no", () => {
    const uno = minhash(LIMPIO.description);
    const casi = minhash(`${LIMPIO.description} También hago mantenimiento.`);
    const otro = minhash("Doy clases de guitarra para principiantes en Montevideo, a domicilio.");

    expect(similarity(uno, casi)).toBeGreaterThan(0.75);
    expect(similarity(uno, otro)).toBeLessThan(0.2);
  });

  test("una firma vacía no se parece a nada", () => {
    expect(similarity("", minhash(LIMPIO.description))).toBe(0);
  });

  test("los shingles son ventanas de tres palabras", () => {
    expect(shingles("uno dos tres cuatro")).toEqual(["uno dos tres", "dos tres cuatro"]);
    expect(shingles("uno")).toEqual(["uno"]);
    expect(shingles("")).toEqual([]);
  });

  test("el hash del texto ignora tildes, signos y mayúsculas", () => {
    expect(textHash(con({ title: "Electricista a Domicilio!" }))).toBe(
      textHash(con({ title: "electricista a domicilio" })),
    );
  });
});

describe("dedupe", () => {
  const print = (text: ServiceText, kind: Print["kind"], id = "otro"): Print => ({
    service_id: id,
    kind,
    text_hash: textHash(text),
    signature: minhash(
      [text.title, text.summary, text.description, text.skills.join(" ")].join("\n"),
    ),
  });

  test("el mismo texto subido de nuevo se reconoce", () => {
    const señales = duplicates(LIMPIO, [print(LIMPIO, "published")]);
    expect(codes(señales)).toEqual(["copia"]);
  });

  test("lo que ya se rechazó pesa más", () => {
    const rechazado = duplicates(LIMPIO, [print(LIMPIO, "rejected")]);
    const publicado = duplicates(LIMPIO, [print(LIMPIO, "published")]);

    expect(codes(rechazado)).toEqual(["copia-rechazada"]);
    expect(rechazado[0]?.weight).toBeGreaterThan(publicado[0]?.weight ?? 0);
  });

  test("un texto distinto no es una copia", () => {
    const otro = con({
      title: "Clases de guitarra",
      description: "Doy clases de guitarra para principiantes, a domicilio, en Montevideo.",
    });
    expect(duplicates(otro, [print(LIMPIO, "rejected")])).toEqual([]);
  });
});

describe("coherencia", () => {
  test("un servicio que habla de lo suyo no levanta nada", () => {
    expect(coherence(LIMPIO)).toEqual([]);
  });

  test("un rubro que el texto no menciona sube en la cola", () => {
    const señales = coherence(con({ category: "salud" }));
    expect(codes(señales)).toContain("rubro");
    expect(señales[0]?.detail).toContain("oficios");
  });

  test("otros no promete nada, así que no hay incoherencia", () => {
    expect(codes(coherence(con({ category: "otros" })))).not.toContain("rubro");
  });

  test("un título que no aparece en la descripción se marca", () => {
    const señales = coherence(
      con({ title: "Oportunidad única", description: "Consultá disponibilidad y formas de pago." }),
    );
    expect(codes(señales)).toContain("titulo");
  });
});

describe("review", () => {
  test("lo limpio queda en cero y va a la cola", () => {
    const resultado = review(LIMPIO);
    expect(resultado.score).toBe(0);
    expect(resultado.decision).toBe("queue");
  });

  test("el puntaje suma y no pasa de cien", () => {
    const sucio = con({
      title: "GANA PLATA YA",
      description: "ESCRIBIME A juana@ejemplo.com O AL 099 123 456 https://spam.example",
      category: "salud",
      skills: [],
    });

    const resultado = review(sucio);
    expect(resultado.score).toBe(100);
    expect(resultado.reasons.length).toBeGreaterThan(3);
  });

  test("volver a subir lo que ya se rechazó es lo único que se rechaza solo", () => {
    const print: Print = {
      service_id: "otro",
      kind: "rejected",
      text_hash: textHash(LIMPIO),
      signature: minhash(
        [LIMPIO.title, LIMPIO.summary, LIMPIO.description, LIMPIO.skills.join(" ")].join("\n"),
      ),
    };

    /** Con algo más encima del parecido, que solo la copia no alcanza. */
    const sucio = con({ description: `${LIMPIO.description} escribime a juana@ejemplo.com` });
    expect(review(sucio, [print]).decision).toBe("reject");

    /** Lo mismo pero contra algo publicado se queda esperando a una persona. */
    expect(review(sucio, [{ ...print, kind: "published" }]).decision).toBe("queue");
  });
});
