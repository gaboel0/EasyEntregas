import type {
  CourierProfile,
  Delivery,
  ID,
  OperationalSettings,
  Order,
  OrderHistoryEntry,
  StatusChangeEntry,
} from '@/types/domain'
import { deliveryEconomics, type DeliveryEconomics } from '@/modules/deliveries/deliveryCost'
import { isPickup } from '@/modules/orders/orderWorkflow'

/** Pedido enriquecido para a interface: entrega atual, motoboy, espera e economia do frete. */
export interface OrderView {
  order: Order
  /** Tentativa de entrega mais recente. */
  delivery: Delivery | null
  deliveries: Delivery[]
  courier: CourierProfile | null
  history: OrderHistoryEntry[]
  total: number
  /** Momento em que o pedido ficou pronto e passou a aguardar despacho. */
  waitingSince: string | null
  waitingMinutes: number | null
  isDispatchLate: boolean
  economics: DeliveryEconomics
  /** Quando a entrega foi concluída com sucesso. */
  deliveredAt: string | null
}

const WAITING_STATUSES = new Set(['ready_for_pickup', 'awaiting_courier'])

export function groupBy<T>(items: readonly T[], key: (item: T) => ID): Map<ID, T[]> {
  const map = new Map<ID, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

/**
 * Início da espera atual por despacho: a entrada mais recente em "pronto"/"aguardando"
 * vinda de um status que não era de espera (para não reiniciar o relógio entre os dois).
 */
export function waitingSinceFrom(history: readonly OrderHistoryEntry[]): string | null {
  const statusChanges = history.filter((h): h is StatusChangeEntry => h.kind === 'status_change')
  for (let i = statusChanges.length - 1; i >= 0; i--) {
    const entry = statusChanges[i]!
    if (WAITING_STATUSES.has(entry.to) && (!entry.from || !WAITING_STATUSES.has(entry.from))) return entry.at
  }
  return null
}

export function buildOrderViews(params: {
  orders: readonly Order[]
  deliveries: readonly Delivery[]
  history: readonly OrderHistoryEntry[]
  couriers: readonly CourierProfile[]
  settings: OperationalSettings
  now: Date
}): OrderView[] {
  const { settings, now } = params
  const deliveriesByOrder = groupBy(params.deliveries, (d) => d.orderId)
  const historyByOrder = groupBy(params.history, (h) => h.orderId)
  const courierById = new Map(params.couriers.map((c) => [c.id, c]))

  return params.orders.map((order) => {
    const deliveries = (deliveriesByOrder.get(order.id) ?? []).slice().sort((a, b) => a.attempt - b.attempt)
    const delivery = deliveries[deliveries.length - 1] ?? null
    const history = (historyByOrder.get(order.id) ?? []).slice().sort((a, b) => a.at.localeCompare(b.at))
    const courier = delivery?.courierId ? (courierById.get(delivery.courierId) ?? null) : null
    const waiting = WAITING_STATUSES.has(order.status)
    const waitingSince = waiting ? waitingSinceFrom(history) : null
    const waitingMinutes = waitingSince ? (now.getTime() - new Date(waitingSince).getTime()) / 60000 : null
    return {
      order,
      delivery,
      deliveries,
      courier,
      history,
      total: Math.round((order.productsTotal + order.freightFee) * 100) / 100,
      waitingSince,
      waitingMinutes,
      isDispatchLate: !isPickup(order) && waitingMinutes !== null && waitingMinutes >= settings.dispatchAlertMinutes,
      economics: deliveryEconomics(order, delivery, courier, settings),
      deliveredAt:
        order.status === 'delivered'
          ? (delivery?.completedAt ?? [...history].reverse().find((h) => h.kind === 'status_change' && h.to === 'delivered')?.at ?? null)
          : null,
    }
  })
}
