import { describe, expect, it } from 'vitest'
import {
  ALL_ORDER_STATUSES,
  canAssignCourier,
  canTransition,
  deliveryStatusFor,
  isTerminal,
  nextStatus,
  ORDER_FLOW,
} from '@/modules/orders/orderWorkflow'

const withCourier = { hasCourier: true }
const noCourier = { hasCourier: false }

describe('transições de status do pedido', () => {
  it('permite seguir o fluxo principal passo a passo', () => {
    for (let i = 0; i < ORDER_FLOW.length - 1; i++) {
      expect(canTransition(ORDER_FLOW[i]!, ORDER_FLOW[i + 1]!, withCourier).allowed).toBe(true)
    }
  })

  it('não permite pular etapas', () => {
    expect(canTransition('received', 'delivered', withCourier).allowed).toBe(false)
    expect(canTransition('preparing', 'out_for_delivery', withCourier).allowed).toBe(false)
    expect(canTransition('ready_for_pickup', 'delivered', withCourier).allowed).toBe(false)
  })

  it('não considera entregue só porque recebeu motoboy', () => {
    expect(canTransition('awaiting_courier', 'delivered', withCourier).allowed).toBe(false)
  })

  it('exige motoboy para registrar a saída', () => {
    const check = canTransition('awaiting_courier', 'out_for_delivery', noCourier)
    expect(check.allowed).toBe(false)
    if (!check.allowed) expect(check.reason).toMatch(/motoboy/)
  })

  it('não permite voltar etapas', () => {
    expect(canTransition('out_for_delivery', 'preparing', withCourier).allowed).toBe(false)
  })

  it('não permite cancelar diretamente um pedido em rota (registra-se falha antes)', () => {
    expect(canTransition('out_for_delivery', 'cancelled', withCourier).allowed).toBe(false)
    expect(canTransition('out_for_delivery', 'delivery_failed', withCourier).allowed).toBe(true)
  })

  it('após falha permite nova tentativa ou cancelamento', () => {
    expect(canTransition('delivery_failed', 'awaiting_courier', noCourier).allowed).toBe(true)
    expect(canTransition('delivery_failed', 'cancelled', noCourier).allowed).toBe(true)
    expect(canTransition('delivery_failed', 'delivered', withCourier).allowed).toBe(false)
  })

  it('estados terminais não têm saída', () => {
    for (const to of ALL_ORDER_STATUSES) {
      expect(canTransition('delivered', to, withCourier).allowed).toBe(false)
      expect(canTransition('cancelled', to, withCourier).allowed).toBe(false)
    }
    expect(isTerminal('delivered')).toBe(true)
    expect(isTerminal('delivery_failed')).toBe(false)
  })

  it('pode cancelar antes da saída', () => {
    for (const from of ['received', 'preparing', 'ready_for_pickup', 'awaiting_courier'] as const) {
      expect(canTransition(from, 'cancelled', noCourier).allowed).toBe(true)
    }
  })
})

describe('auxiliares do fluxo', () => {
  it('nextStatus segue o fluxo principal', () => {
    expect(nextStatus('received')).toBe('preparing')
    expect(nextStatus('out_for_delivery')).toBe('delivered')
    expect(nextStatus('delivered')).toBeNull()
    expect(nextStatus('delivery_failed')).toBe('awaiting_courier')
  })

  it('motoboy só pode ser atribuído antes da saída', () => {
    expect(canAssignCourier('preparing')).toBe(true)
    expect(canAssignCourier('awaiting_courier')).toBe(true)
    expect(canAssignCourier('out_for_delivery')).toBe(false)
    expect(canAssignCourier('delivered')).toBe(false)
  })

  it('status da entrega acompanha o pedido', () => {
    expect(deliveryStatusFor('preparing', false)).toBe('unassigned')
    expect(deliveryStatusFor('preparing', true)).toBe('assigned')
    expect(deliveryStatusFor('out_for_delivery', true)).toBe('in_transit')
    expect(deliveryStatusFor('delivered', true)).toBe('delivered')
    expect(deliveryStatusFor('delivery_failed', true)).toBe('failed')
  })
})
