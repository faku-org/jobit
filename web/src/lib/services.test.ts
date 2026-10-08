import { describe, expect, test } from "bun:test";
import {
  EMPTY_SERVICE_FILTERS,
  type ServicePrice,
  type Service,
  basePrice,
  extraPrices,
  formatPrice,
  hasActiveServiceFilters,
  hoursByDay,
  serviceLocation,
  servicesQuery,
} from "./services.ts";

const price = (extra: Partial<ServicePrice> = {}): ServicePrice => ({
  kind: "base",
  label: "Hora de trabajo",
  amount: 1200,
  currency: "UYU",
  unit: "hora",
  notes: "",
  ...extra,
});

const service = (extra: Partial<Service> = {}): Service =>
  ({
    id: "s1",
    title: "Electricista a domicilio",
    slug: "electricista-a-domicilio",
    summary: "",
    description: "",
    category: "oficios",
    department: "Canelones",
    city: "Las Piedras",
    remote: "onsite",
    fixed_price: false,
    work_style: "individual",
    experience_years: null,
    availability_note: "",
    response_time: "",
    status: "published",
    rating_avg: 0,
    rating_count: 0,
    created_at: "2026-09-01",
    updated_at: "2026-09-01",
    published_at: "2026-09-01",
    skills: [],
    prices: [],
    hours: [],
    owner_handle: "juana",
    owner_name: "Juana Pérez",
    ...extra,
  }) as Service;

describe("servicesQuery", () => {
  test("una lista sin filtros pide la primera página y nada más", () => {
    expect(servicesQuery(EMPTY_SERVICE_FILTERS)).toBe("limit=24&offset=0");
  });

  test("el tope de precio viaja con la moneda en la que se leyó", () => {
    const query = servicesQuery({ ...EMPTY_SERVICE_FILTERS, priceMax: 50, currency: "USD" });
    expect(query).toContain("price_max=50");
    expect(query).toContain("currency=USD");
  });

  test("sin tope, la moneda no viaja: no habría qué comparar", () => {
    expect(servicesQuery({ ...EMPTY_SERVICE_FILTERS, currency: "USD" })).not.toContain("currency");
  });

  test("los filtros van con los nombres que toma la API", () => {
    const query = servicesQuery({
      ...EMPTY_SERVICE_FILTERS,
      q: "  electricista ",
      category: "oficios",
      department: "Canelones",
      mode: "remote",
      ratingMin: 4,
      sort: "rating",
    });

    expect(query).toContain("q=electricista");
    expect(query).toContain("category=oficios");
    expect(query).toContain("department=Canelones");
    expect(query).toContain("remote=remote");
    expect(query).toContain("rating_min=4");
    expect(query).toContain("sort=rating");
  });

  test("pagina desde donde quedó", () => {
    expect(servicesQuery(EMPTY_SERVICE_FILTERS, 24)).toContain("offset=24");
  });
});

describe("hasActiveServiceFilters", () => {
  test("una lista recién abierta no tiene nada que limpiar", () => {
    expect(hasActiveServiceFilters(EMPTY_SERVICE_FILTERS)).toBe(false);
  });

  test("ordenar distinto ya es un filtro puesto a mano", () => {
    expect(hasActiveServiceFilters({ ...EMPTY_SERVICE_FILTERS, sort: "price" })).toBe(true);
  });
});

describe("los precios", () => {
  test("el de la tarjeta es el base, no el extra", () => {
    const entry = service({ prices: [price({ kind: "extra", amount: 30 }), price()] });
    expect(basePrice(entry)?.amount).toBe(1200);
    expect(extraPrices(entry)).toHaveLength(1);
  });

  test("se escriben con el símbolo de su moneda y su unidad", () => {
    expect(formatPrice(price())).toBe("$ 1.200 por hora");
    expect(formatPrice(price({ amount: 30, currency: "USD", unit: "" }))).toBe("US$ 30");
  });
});

describe("dónde se presta", () => {
  test("ciudad y departamento cuando son distintos", () => {
    expect(serviceLocation(service())).toBe("Las Piedras, Canelones");
  });

  test("a distancia y sin departamento dice eso y no “Uruguay”", () => {
    expect(serviceLocation(service({ remote: "remote", city: "", department: "" }))).toBe(
      "A distancia",
    );
  });
});

describe("hoursByDay", () => {
  test("junta los tramos del mismo día y ordena de domingo a sábado", () => {
    const days = hoursByDay([
      { weekday: 3, from: "14:00", to: "18:00" },
      { weekday: 1, from: "09:00", to: "12:00" },
      { weekday: 1, from: "14:00", to: "18:00" },
    ]);

    expect(days).toHaveLength(2);
    expect(days[0]?.label).toBe("Lunes");
    expect(days[0]?.ranges).toEqual(["09:00 a 12:00", "14:00 a 18:00"]);
    expect(days[1]?.label).toBe("Miércoles");
  });
});
