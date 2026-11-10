import { describe, expect, test } from 'bun:test'
import {
  type CheckoutSession,
  type Jurisdiction,
  type Order,
  type PaymentProvider,
  type ProviderId,
  createPaymentRegistry,
  payments,
} from './payments.ts'

const URUGUAY: Jurisdiction = {
  provider_country: 'UY',
  customer_country: 'UY',
  regime: 'iva-basico',
  tax_rate: 0.22,
}

const BRASIL: Jurisdiction = {
  ...URUGUAY,
  provider_country: 'BR',
  customer_country: 'BR',
}

const ORDER: Order = {
  id: 'o1',
  item: { kind: 'boost', service_id: 's1', days: 7 },
  amount: { value: 300, currency: 'UYU', rate: null },
  jurisdiction: URUGUAY,
  day: '2026-11-05',
}

/** Un proveedor de mentira que registra qué le pidieron. */
function fake(
  id: ProviderId,
  countries: string[],
): PaymentProvider & { calls: Order[] } {
  const calls: Order[] = []
  return {
    id,
    nativeSplit: true,
    calls,
    supports: (jurisdiction) =>
      countries.includes(jurisdiction.provider_country),
    async createCheckout(order): Promise<{ ok: true; value: CheckoutSession }> {
      calls.push(order)
      return {
        ok: true,
        value: {
          ref: { provider: id, external_id: `x-${order.id}` },
          url: 'https://pago.example/x',
        },
      }
    },
    async splitPayout() {
      return { ok: false, error: 'no usado' }
    },
    async verifyWebhook() {
      return { ok: false, error: 'firma inválida' }
    },
  }
}

describe('el registro', () => {
  test('hoy no hay ningún proveedor y se dice, no se inventa uno', async () => {
    expect(payments.providerFor(URUGUAY)).toEqual({
      ok: false,
      error: 'no hay un proveedor de pago para esa jurisdicción',
    })
    expect((await payments.createCheckout(ORDER)).ok).toBe(false)
    expect(payments.byId('mercadopago')).toBeNull()
    expect(payments.byId('stripe')).toBeNull()
  })

  test('elige por la jurisdicción de la operación y no por una variable global', async () => {
    const registry = createPaymentRegistry()
    const mercadopago = fake('mercadopago', ['UY'])
    const stripe = fake('stripe', ['BR', 'MX'])
    expect(registry.register(mercadopago).ok).toBe(true)
    expect(registry.register(stripe).ok).toBe(true)

    const uy = registry.providerFor(URUGUAY)
    const br = registry.providerFor(BRASIL)
    expect(uy.ok && uy.value.id).toBe('mercadopago')
    expect(br.ok && br.value.id).toBe('stripe')

    const session = await registry.createCheckout({
      ...ORDER,
      jurisdiction: BRASIL,
    })
    expect(session.ok && session.value.ref).toEqual({
      provider: 'stripe',
      external_id: 'x-o1',
    })
    expect(stripe.calls).toHaveLength(1)
    expect(mercadopago.calls).toHaveLength(0)
  })

  test('una jurisdicción que ninguno cubre no cae en otro proveedor', () => {
    const registry = createPaymentRegistry()
    registry.register(fake('mercadopago', ['UY']))

    expect(
      registry.providerFor({ ...URUGUAY, provider_country: 'AR' }).ok,
    ).toBe(false)
  })

  test('sin split nativo no entra: la plataforma no custodia fondos de terceros', () => {
    const registry = createPaymentRegistry()
    const custodial = {
      ...fake('stripe', ['UY']),
      nativeSplit: false,
    } as unknown as PaymentProvider

    const result = registry.register(custodial)
    expect(result.ok).toBe(false)
    expect(registry.byId('stripe')).toBeNull()
  })

  test('el mismo proveedor no se registra dos veces', () => {
    const registry = createPaymentRegistry()
    expect(registry.register(fake('mercadopago', ['UY'])).ok).toBe(true)
    expect(registry.register(fake('mercadopago', ['UY'])).ok).toBe(false)
  })
})

describe('lo que guarda una orden', () => {
  test('lleva la jurisdicción completa y el monto en su moneda, sin quién paga', () => {
    expect(Object.keys(ORDER).sort()).toEqual([
      'amount',
      'day',
      'id',
      'item',
      'jurisdiction',
    ])
    expect(Object.keys(ORDER.jurisdiction).sort()).toEqual([
      'customer_country',
      'provider_country',
      'regime',
      'tax_rate',
    ])
    expect(ORDER.amount).toEqual({ value: 300, currency: 'UYU', rate: null })
  })
})
