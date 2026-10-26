import type { CourierProfile, Delivery, OrderSource, OrderStatus } from '@/types/domain'
import type { OrderView } from '@/modules/orders/orderViews'
import { ALL_ORDER_STATUSES, PRE_DISPATCH_STATUSES } from '@/modules/orders/orderWorkflow'
import { ORDER_SOURCES } from '@/modules/orders/orderLabels'
import { average, roundMoney, sum } from '@/utils/number'
import { eachDay, isWithin, type DateRange } from '@/utils/date'

/**
 * Indicadores calculados exclusivamente a partir dos pedidos e entregas registrados.
 *
 * Definições (exibidas também na interface):
 * - Fretes cobrados: soma do frete dos pedidos ENTREGUES (receita de frete realizada).
 * - Custo das entregas: soma do custo de todas as tentativas encerradas (entregues ou com falha).
 * - Resultado dos fretes: fretes cobrados − custo das entregas.
 * - Tempo médio de entrega: do registro do pedido até a confirmação da entrega.
 * - Tempo médio em rota: da saída do motoboy até a confirmação da entrega.
 * - Taxa de conclusão: entregues ÷ (entregues + cancelados + com falha pendente).
 */

export interface PeriodMetrics {
  orders: number
  delivered: number
  cancelled: number
  failedOpen: number
  inPreparation: number
  awaitingDispatch: number
  awaitingCourier: number
  outForDelivery: number
  lateDispatch: number
  freightRevenue: number
  productsRevenue: number
  deliveryCost: number
  courierPay: number
  freightResult: number
  marginPct: number | null
  avgDeliveryMinutes: number | null
  avgRouteMinutes: number | null
  completionRate: number | null
  negativeResultDeliveries: number
  unknownDistanceOrders: number
}

const closedAttempts = (v: OrderView) => v.deliveries.filter((d) => d.costSnapshot)

function attemptCost(d: Delivery): number {
  return d.costSnapshot?.operationalCost ?? 0
}

export function filterByPeriod(views: readonly OrderView[], range: DateRange): OrderView[] {
  return views.filter((v) => isWithin(v.order.createdAt, range))
}

export function computeMetrics(views: readonly OrderView[]): PeriodMetrics {
  const delivered = views.filter((v) => v.order.status === 'delivered')
  const cancelled = views.filter((v) => v.order.status === 'cancelled')
  const failedOpen = views.filter((v) => v.order.status === 'delivery_failed')
  const attempts = views.flatMap(closedAttempts)

  const freightRevenue = roundMoney(sum(delivered.map((v) => v.order.freightFee)))
  const deliveryCost = roundMoney(sum(attempts.map(attemptCost)))
  const freightResult = roundMoney(freightRevenue - deliveryCost)

  const deliveryMinutes = delivered
    .filter((v) => v.deliveredAt)
    .map((v) => (new Date(v.deliveredAt!).getTime() - new Date(v.order.createdAt).getTime()) / 60000)
  const routeMinutes = attempts
    .filter((d) => d.status === 'delivered' && d.dispatchedAt && d.completedAt)
    .map((d) => (new Date(d.completedAt!).getTime() - new Date(d.dispatchedAt!).getTime()) / 60000)

  const finalized = delivered.length + cancelled.length + failedOpen.length

  return {
    orders: views.length,
    delivered: delivered.length,
    cancelled: cancelled.length,
    failedOpen: failedOpen.length,
    inPreparation: views.filter((v) => v.order.status === 'received' || v.order.status === 'preparing').length,
    awaitingDispatch: views.filter((v) => PRE_DISPATCH_STATUSES.includes(v.order.status) && v.order.fulfillment !== 'pickup' && !v.delivery?.courierId).length,
    awaitingCourier: views.filter((v) => v.order.status === 'awaiting_courier').length,
    outForDelivery: views.filter((v) => v.order.status === 'out_for_delivery').length,
    lateDispatch: views.filter((v) => v.isDispatchLate).length,
    freightRevenue,
    productsRevenue: roundMoney(sum(delivered.map((v) => v.order.productsTotal))),
    deliveryCost,
    courierPay: roundMoney(sum(attempts.map((d) => d.costSnapshot?.courierPay ?? 0))),
    freightResult,
    marginPct: freightRevenue > 0 ? (freightResult / freightRevenue) * 100 : null,
    avgDeliveryMinutes: average(deliveryMinutes),
    avgRouteMinutes: average(routeMinutes),
    completionRate: finalized > 0 ? (delivered.length / finalized) * 100 : null,
    negativeResultDeliveries: delivered.filter((v) => v.economics.result < 0).length,
    unknownDistanceOrders: views.filter((v) => v.order.address.distanceKm === null).length,
  }
}

export function countByStatus(views: readonly OrderView[]): Record<OrderStatus, number> {
  const counts = Object.fromEntries(ALL_ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>
  for (const v of views) counts[v.order.status]++
  return counts
}

export interface SourceRow {
  source: OrderSource
  orders: number
  delivered: number
  productsRevenue: number
  freightRevenue: number
}

export function bySource(views: readonly OrderView[]): SourceRow[] {
  return ORDER_SOURCES.map((source) => {
    const list = views.filter((v) => v.order.source === source)
    const delivered = list.filter((v) => v.order.status === 'delivered')
    return {
      source,
      orders: list.length,
      delivered: delivered.length,
      productsRevenue: roundMoney(sum(delivered.map((v) => v.order.productsTotal))),
      freightRevenue: roundMoney(sum(delivered.map((v) => v.order.freightFee))),
    }
  })
}

export interface CourierRow {
  courierId: string
  name: string
  internalCode: string
  attempts: number
  delivered: number
  failed: number
  freightRevenue: number
  courierPay: number
  deliveryCost: number
  result: number
  avgRouteMinutes: number | null
  distanceKm: number
}

/** Desempenho por motoboy considerando as tentativas encerradas no conjunto de pedidos. */
export function byCourier(views: readonly OrderView[], couriers: readonly CourierProfile[]): CourierRow[] {
  const rows = new Map<string, CourierRow & { routes: number[] }>()
  const nameOf = new Map(couriers.map((c) => [c.id, c]))
  for (const v of views) {
    for (const d of closedAttempts(v)) {
      if (!d.courierId) continue
      const profile = nameOf.get(d.courierId)
      let row = rows.get(d.courierId)
      if (!row) {
        row = {
          courierId: d.courierId,
          name: profile?.name ?? 'Motoboy removido',
          internalCode: profile?.link.internalCode ?? '—',
          attempts: 0, delivered: 0, failed: 0, freightRevenue: 0, courierPay: 0, deliveryCost: 0, result: 0,
          avgRouteMinutes: null, distanceKm: 0, routes: [],
        }
        rows.set(d.courierId, row)
      }
      row.attempts++
      row.courierPay += d.costSnapshot?.courierPay ?? 0
      row.deliveryCost += attemptCost(d)
      row.distanceKm += d.costSnapshot?.distanceUsedKm ?? 0
      if (d.status === 'delivered') {
        row.delivered++
        row.freightRevenue += v.order.freightFee
        if (d.dispatchedAt && d.completedAt) {
          row.routes.push((new Date(d.completedAt).getTime() - new Date(d.dispatchedAt).getTime()) / 60000)
        }
      } else if (d.status === 'failed') {
        row.failed++
      }
    }
  }
  return [...rows.values()]
    .map(({ routes, ...row }) => ({
      ...row,
      freightRevenue: roundMoney(row.freightRevenue),
      courierPay: roundMoney(row.courierPay),
      deliveryCost: roundMoney(row.deliveryCost),
      result: roundMoney(row.freightRevenue - row.deliveryCost),
      distanceKm: Math.round(row.distanceKm * 10) / 10,
      avgRouteMinutes: average(routes),
    }))
    .sort((a, b) => b.delivered - a.delivered)
}

export interface DayRow {
  date: Date
  orders: number
  delivered: number
  cancelled: number
  freightRevenue: number
  deliveryCost: number
  result: number
}

export function byDay(views: readonly OrderView[], range: DateRange): DayRow[] {
  return eachDay(range).map((date) => {
    const key = date.toDateString()
    const list = views.filter((v) => new Date(v.order.createdAt).toDateString() === key)
    const m = computeMetrics(list)
    return {
      date,
      orders: m.orders,
      delivered: m.delivered,
      cancelled: m.cancelled,
      freightRevenue: m.freightRevenue,
      deliveryCost: m.deliveryCost,
      result: m.freightResult,
    }
  })
}

/** Pedidos por hora do dia (0–23). */
export function byHour(views: readonly OrderView[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0)
  for (const v of views) hours[new Date(v.order.createdAt).getHours()]!++
  return hours
}
