import { describe, expect, test } from "bun:test";
import { fold } from "./catalog.ts";
import { isEmptyReading, readCv, readExperience, splitCv } from "./cv.ts";

const YEAR = 2026;
const read = (text: string) => readCv(text, YEAR);

describe("readExperience", () => {
  const years = (text: string) => readExperience(fold(text), YEAR);

  test("an explicit statement is taken at its word", () => {
    expect(years("Tengo 7 años de experiencia en ventas")).toBe(7);
    expect(years("5+ años de experiencia")).toBe(5);
  });

  test("periods add up when they do not overlap", () => {
    expect(years("2014 - 2016\n2018 - 2021")).toBe(5);
  });

  test("two jobs held at once are one stretch, not two", () => {
    expect(years("2018 - 2022\n2020 - 2023")).toBe(5);
  });

  test("an open period runs to today", () => {
    expect(years("2023 - actualidad")).toBe(3);
    expect(years("03/2024 – presente")).toBe(2);
  });

  test("impossible periods are ignored", () => {
    expect(years("1850 - 1900")).toBeNull();
    expect(years("2030 - 2035")).toBeNull();
  });

  test("a CV that says nothing about time answers nothing", () => {
    expect(years("Vendedor en una tienda de ropa")).toBeNull();
  });
});

describe("readCv", () => {
  test("recognises títulos and cursos, and nothing else", () => {
    const reading = read(`
      Formación
      Licenciatura en Informática, Universidad de la República
      Inglés avanzado
      Excel avanzado
      Aficiones: ajedrez y jardinería japonesa
    `);
    expect(reading.degrees).toContain("lic-informatica");
    expect(reading.courses).toContain("ingles-avanzado");
    expect(reading.courses).toContain("excel-avanzado");
    expect(reading.education).toBe("university");
  });

  test("the level comes from the highest título found", () => {
    expect(read("Bachillerato en Informática. Maestría en Administración.").education).toBe(
      "postgrad",
    );
  });

  test("a level named without a título still counts", () => {
    expect(read("Estudios terciarios incompletos en UTU").education).toBe("technical");
  });

  test("suggests rubros from the work the CV describes", () => {
    const reading = read("Desarrollador de software. Trabajé con Python y bases de datos SQL.");
    expect(reading.categories).toContain("tecnologia");
  });

  test("empty text reads as nothing at all", () => {
    expect(isEmptyReading(read("   "))).toBe(true);
    expect(read("").characters).toBe(0);
  });

  test("a CV about something else adds no studies", () => {
    const reading = read("Me gusta cocinar los domingos.");
    expect(reading.degrees).toEqual([]);
  });

  test("counts the text it managed to read, to explain an empty result", () => {
    expect(read("hola mundo").characters).toBe(10);
  });
});

/** Un CV real, con sus secciones, sin datos de nadie. Los dos que motivaron
 * esto se leían como un arquitecto universitario con seis años de experiencia. */
const CV = `
Desarrollador Web Full-Stack

RESUMEN PROFESIONAL
Egresando del Bachillerato Tecnológico en Informática de UTU, con experiencia
construyendo y desplegando productos web con APIs en producción.

FORMACIÓN ACADÉMICA
Bachillerato Tecnológico en Informática — UTU
3.er año en curso · Egreso estimado: 2026

EXPERIENCIA PROFESIONAL
Desarrollador web freelance · Buenno (restaurante italiano) · 2026
Sitio bilingüe con menú, buscador y filtros.

PROYECTOS DESTACADOS
Lux — Arquitectura de microservicios y almacenamiento de artefactos, con
auditoría de cambios y estadísticas de uso. Sitio de marketing aparte.

HABILIDADES TÉCNICAS
TypeScript, JavaScript, SQL, arquitectura de contenido

HABILIDADES BLANDAS
Orientación a producto: diseño UI con estética cuidada

IDIOMAS
Inglés: B2 Level
`;

describe("readCv por secciones", () => {
  const reading = read(CV);

  test("un título nombrado en proyectos no es un título", () => {
    expect(reading.degrees).not.toContain("arquitectura");
    expect(reading.education).toBe("secondary");
  });

  test("el bachillerato se reconoce por su orientación, sin duplicar el genérico", () => {
    expect(reading.degrees).toEqual(["bach-informatica"]);
  });

  test("lo que se hizo en un trabajo no es un curso que se tomó", () => {
    expect(reading.courses).not.toContain("italiano");
    expect(reading.courses).not.toContain("estetica");
  });

  test("el nivel de idioma se lee aunque lo separen dos puntos", () => {
    expect(reading.courses).toContain("ingles-intermedio");
  });

  test("el rubro sale del trabajo, no de las herramientas ni de los proyectos", () => {
    expect(reading.categories).toEqual(["tecnologia"]);
  });

  test("las fechas de la formación no son años trabajados", () => {
    const estudiante = read(`
      EXPERIENCIA LABORAL
      Cajero · 2023 – Actualidad

      FORMACIÓN ACADÉMICA
      Tecnicatura en Tecnología · 2024 – Actualidad
      Bachillerato – Opción Informática · 2020 – 2023
    `);
    expect(estudiante.experienceYears).toBe(YEAR - 2023);
    expect(estudiante.education).toBe("technical");
  });

  test("un CV sin encabezados se sigue leyendo entero", () => {
    const suelto = read("Licenciatura en Informática. Inglés avanzado. 5 años de experiencia.");
    expect(suelto.degrees).toContain("lic-informatica");
    expect(suelto.courses).toContain("ingles-avanzado");
    expect(suelto.experienceYears).toBe(5);
  });
});

describe("readCv ubicación", () => {
  test("a city names its department", () => {
    const reading = read("Facundo\nCiudad de la Costa, Uruguay (Canelones)\nDesarrollador");
    expect(reading.places).toEqual([
      { department: "Canelones", label: "Ciudad de la Costa (Canelones)" },
    ]);
  });

  test("a department named on its own is enough", () => {
    expect(read("Vivo en Montevideo.").places).toEqual([
      { department: "Montevideo", label: "Montevideo" },
    ]);
  });

  test("city and department of the same place do not duplicate", () => {
    const reading = read("Ciudad de la Costa, Canelones, Uruguay");
    expect(reading.places).toHaveLength(1);
    expect(reading.places[0]?.department).toBe("Canelones");
  });

  test("uruguay the country is not a department", () => {
    expect(read("Nacionalidad: Uruguaya.").places).toEqual([]);
  });
});

describe("splitCv", () => {
  test("cada línea pertenece al último encabezado leído", () => {
    const blocks = splitCv(fold("Ana\nEXPERIENCIA LABORAL\nCajera\nFORMACIÓN\nBachillerato"));
    expect(blocks.profile.trim()).toBe("ana");
    expect(blocks.experience.trim()).toBe("cajera");
    expect(blocks.education.trim()).toBe("bachillerato");
  });

  test("una oración que empieza como un encabezado no es uno", () => {
    const linea = "experiencia en atencion al cliente y gestion operativa en entornos exigentes";
    expect(splitCv(linea).profile.trim()).toBe(linea);
    expect(splitCv(linea).experience).toBe("");
  });
});
