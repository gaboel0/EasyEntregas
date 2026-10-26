import type { DeliveryStatus, OrderStatus } from '@/types/domain'

/**
 * Máquina de estados do pedido. Estas regras são a fonte de verdade no frontend
 * e devem ser replicadas (e impostas) pelo backend quando houver API.
 */

export const ORDER_FLOW: readonly OrderStatus[] = [
  'received',
  'preparing',
  'ready_for_pickup',
  'awaiting_courier',
  'out_for_delivery',
  'delivered',
] as const

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled']

/** Status em que o pedido ainda não saiu do estabelecimento. */
export const PRE_DISPATCH_STATUSES: readonly OrderStatus[] = [
  'received',
  'preparing',
  'ready_for_pickup',
  'awaiting_courier',
]

/** Pedidos ativos na operação (ainda exigem ação). */
export const ACTIVE_STATUSES: readonly OrderStatus[] = [...PRE_DISPATCH_STATUSES, 'out_for_delivery', 'delivery_failed']

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  received: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['awaiting_courier', 'cancelled'],
  awaiting_courier: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'delivery_failed'],
  // Após uma falha o pedido pode voltar para a fila de despacho (nova tentativa) ou ser cancelado.
  delivery_failed: ['awaiting_courier', 'cancelled'],
  delivered: [],
  cancelled: [],
}

export interface TransitionContext {
  hasCourier: boolean
}

export type TransitionCheck = { allowed: true } | { allowed: false; reason: string }

export function allowedTargets(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from]
}

export function canTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext): TransitionCheck {
  if (from === to) return { allowed: false, reason: 'O pedido já está neste status.' }
  if (!TRANSITIONS[from].includes(to)) {
    return {
      allowed: false,
      reason: `Não é possível mudar de "${ORDER_STATUS_LABEL[from]}" para "${ORDER_STATUS_LABEL[to]}".`,
    }
  }
  if (to === 'out_for_delivery' && !ctx.hasCourier) {
    return { allowed: false, reason: 'Atribua um motoboy antes de registrar a saída para entrega.' }
  }
  return { allowed: true }
}

/** Próximo passo do fluxo principal, usado nos botões de ação rápida. */
export function nextStatus(from: OrderStatus): OrderStatus | null {
  if (from === 'delivery_failed') return 'awaiting_courier'
  const index = ORDER_FLOW.indexOf(from)
  if (index === -1 || index === ORDER_FLOW.length - 1) return null
  return ORDER_FLOW[index + 1] ?? null
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** Motoboy só pode ser (re)atribuído antes da saída. Após falha, o pedido volta ao despacho primeiro. */
export function canAssignCourier(status: OrderStatus): boolean {
  return PRE_DISPATCH_STATUSES.includes(status)
}

export function canEditOrder(status: OrderStatus): boolean {
  return !isTerminal(status)
}

export function requiresReason(to: OrderStatus): boolean {
  return to === 'cancelled' || to === 'delivery_failed'
}

/** Como o status da entrega (logística) acompanha o status do pedido (venda). */
export function deliveryStatusFor(orderStatus: OrderStatus, hasCourier: boolean): DeliveryStatus {
  switch (orderStatus) {
    case 'out_for_delivery':
      return 'in_transit'
    case 'delivered':
      return 'delivered'
    case 'delivery_failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    default:
      return hasCourier ? 'assigned' : 'unassigned'
  }
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Recebido',
  preparing: 'Em preparação',
  ready_for_pickup: 'Pronto para retirada',
  awaiting_courier: 'Aguardando motoboy',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  delivery_failed: 'Falha na entrega',
}

/** Rótulo do botão que leva o pedido AO status indicado. */
export const ORDER_STATUS_ACTION_LABEL: Record<OrderStatus, string> = {
  received: 'Marcar como recebido',
  preparing: 'Iniciar preparo',
  ready_for_pickup: 'Marcar como pronto',
  awaiting_courier: 'Liberar para despacho',
  out_for_delivery: 'Registrar saída',
  delivered: 'Confirmar entrega',
  cancelled: 'Cancelar pedido',
  delivery_failed: 'Registrar falha',
}

export const ALL_ORDER_STATUSES: readonly OrderStatus[] = [...ORDER_FLOW, 'delivery_failed', 'cancelled']
