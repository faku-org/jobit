import type { Result } from "./types.ts";

/**
 * La capa de pagos (#33), como interfaz y sin proveedor real todavía.
 *
 * El resto del sistema habla con `PaymentProvider` y nunca con un SDK. Qué
 * implementación se usa lo decide la jurisdicción de cada operación y no una
 * variable global: Stripe no opera en Uruguay y Mercado Pago no cubre todo
 * Latinoamérica, así que el día que haya expansión van a convivir.
 *
 * Hoy no se registra ninguno y `providerFor` contesta que no hay. Eso es lo
 * correcto: los destacados se otorgan a mano (boosts.ts) hasta que haya un
 * primer cliente, y recién ahí se escribe el primer proveedor, con el CFE en
 * el mismo issue (ver docs/destacados-y-apoyo.md).
 *
 * Reglas que van con esto, escritas acá para que el primer proveedor no las
 * tenga que redescubrir:
 *
 * - Los ids del proveedor se guardan con su proveedor: `ExternalRef` es
 *   `provider` más `external_id`. Nunca una columna `stripe_account_id`, porque
 *   la misma persona puede tener cuenta en dos.
 * - Los montos llevan moneda y, si hubo conversión, la tasa aplicada. Nunca se
 *   guardan convertidos.
 * - La jurisdicción es dato de primera clase desde el día uno, aunque solo
 *   opere Uruguay: agregarla después obliga a recalcular el pasado con datos
 *   que nadie guardó.
 * - El split nativo es requisito excluyente. Una pasarela donde el dinero
 *   entra a la cuenta propia y se gira después convierte a la plataforma en
 *   custodia de fondos de terceros; `register` la rechaza.
 * - Zero Data: una `Order` no lleva quién paga. Eso lo sabe la pasarela, que
 *   es quien lo recolecta; acá solo queda qué se compró y por cuánto.
 */
export const PROVIDER_IDS = ["mercadopago", "stripe"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type PaymentCurrency = "UYU" | "USD";

/** Tasa con la que se convirtió, si hubo conversión. Va al lado del monto. */
export interface AppliedRate {
  pair: "USD/UYU";
  rate: number;
  /** El día de la tasa (YYYY-MM-DD). */
  day: string;
}

export interface Amount {
  /** En la unidad mayor de la moneda, entero, como los precios de servicios. */
  value: number;
  currency: PaymentCurrency;
  rate: AppliedRate | null;
}

/** País del prestador y del cliente, régimen y tasa vigentes al momento de la
 * operación. Los países van en ISO 3166-1 alfa-2. */
export interface Jurisdiction {
  provider_country: string;
  customer_country: string;
  regime: string;
  /** Fracción, no porcentaje: 0.22 es 22 %. */
  tax_rate: number;
}

export interface ExternalRef {
  provider: ProviderId;
  external_id: string;
}

export interface Order {
  id: string;
  /** Qué se compró. Hoy solo la visibilidad destacada de un servicio. */
  item: { kind: "boost"; service_id: string; days: number };
  amount: Amount;
  jurisdiction: Jurisdiction;
  /** El día, nunca la hora. */
  day: string;
}

export interface CheckoutSession {
  ref: ExternalRef;
  /** A donde se manda al navegador. Los datos de tarjeta van de ahí a la
   * pasarela y nunca tocan este servidor (alcance PCI SAQ A). */
  url: string;
}

export interface Payout {
  ref: ExternalRef;
  amount: Amount;
}

export interface PaymentEvent {
  ref: ExternalRef;
  order_id: string;
  type: "paid" | "failed" | "refunded";
  amount: Amount;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  /** Requisito excluyente. El tipo es `true` y no `boolean` para que un
   * proveedor sin split nativo ni compile; `register` lo vuelve a chequear en
   * ejecución por si llega uno con un cast. */
  readonly nativeSplit: true;
  /** Si este proveedor puede operar en esa jurisdicción. */
  supports(jurisdiction: Jurisdiction): boolean;
  createCheckout(order: Order): Promise<Result<CheckoutSession>>;
  splitPayout(order: Order): Promise<Result<Payout>>;
  /** Asíncrono porque hace falta leer el cuerpo crudo de la petición para
   * verificar la firma; con la firma mala no devuelve ningún evento. */
  verifyWebhook(req: Request): Promise<Result<PaymentEvent>>;
}

export interface PaymentRegistry {
  register(provider: PaymentProvider): Result<PaymentProvider>;
  providerFor(jurisdiction: Jurisdiction): Result<PaymentProvider>;
  /** Por id, para el webhook: llega a /webhooks/:provider y no trae jurisdicción. */
  byId(id: ProviderId): PaymentProvider | null;
  createCheckout(order: Order): Promise<Result<CheckoutSession>>;
}

export function createPaymentRegistry(): PaymentRegistry {
  const providers = new Map<ProviderId, PaymentProvider>();

  const providerFor = (jurisdiction: Jurisdiction): Result<PaymentProvider> => {
    for (const provider of providers.values()) {
      if (provider.supports(jurisdiction)) return { ok: true, value: provider };
    }
    return { ok: false, error: "no hay un proveedor de pago para esa jurisdicción" };
  };

  return {
    register(provider) {
      if ((provider.nativeSplit as boolean) !== true) {
        return {
          ok: false,
          error: "el proveedor no tiene split nativo: la plataforma quedaría custodiando fondos",
        };
      }
      if (providers.has(provider.id))
        return { ok: false, error: "ese proveedor ya está registrado" };

      providers.set(provider.id, provider);
      return { ok: true, value: provider };
    },
    providerFor,
    byId: (id) => providers.get(id) ?? null,
    async createCheckout(order) {
      const found = providerFor(order.jurisdiction);
      return found.ok ? found.value.createCheckout(order) : found;
    },
  };
}

/** El registro del proceso. Vacío hasta que exista el primer proveedor. */
export const payments = createPaymentRegistry();
