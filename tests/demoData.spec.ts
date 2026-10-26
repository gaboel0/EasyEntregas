import { describe, expect, it } from 'vitest'
import { createDemoDatabase } from '@/services/local/demoSeed'
import { buildOrderViews } from '@/modules/orders/orderViews'
import { computeMetrics, filterByPeriod } from '@/modules/reports/metrics'
import { rangeForPreset } from '@/utils/date'

const NOW = new Date('2026-10-26T21:00:00-03:00')
const db = createDemoDatabase(NOW)

describe('dados demonstrativos coerentes', () => {
  it('cada pedido tem ao menos uma entrega e histórico que termina no status atual', () => {
    for (const order of db.orders) {
      const deliveries = db.deliveries.filter((d) => d.orderId === order.id)
      expect(deliveries.length).toBeGreaterThan(0)
      const changes = db.orderHistory.filter((h) => h.orderId === order.id && h.kind === 'status_change')
      const last = changes.sort((a, b) => a.at.localeCompare(b.at)).at(-1)
      expect(last && last.kind === 'status_change' ? last.to : null).toBe(order.status)
    }
  })

  it('nenhum evento acontece no futuro', () => {
    expect(db.orderHistory.every((h) => new Date(h.at) <= NOW)).toBe(true)
  })

  it('pedidos em rota ou entregues sempre têm motoboy; entregues têm custo congelado', () => {
    for (const order of db.orders.filter((o) => o.status === 'out_for_delivery' || o.status === 'delivered')) {
      const latest = db.deliveries.filter((d) => d.orderId === order.id).sort((a, b) => b.attempt - a.attempt)[0]!
      expect(latest.courierId).not.toBeNull()
      if (order.status === 'delivered') expect(latest.costSnapshot).not.toBeNull()
    }
  })

  it('tem pedidos de hoje em várias etapas para demonstrar a operação', () => {
    const settings = db.settings.find((s) => s.establishmentId === 'est_bellanapoli')!
    const couriers = db.courierLinks
      .filter((l) => l.establishmentId === 'est_bellanapoli')
      .map((link) => ({ ...db.couriers.find((c) => c.id === link.courierId)!, link }))
    const views = buildOrderViews({
      orders: db.orders.filter((o) => o.establishmentId === 'est_bellanapoli'),
      deliveries: db.deliveries,
      history: db.orderHistory,
      couriers,
      settings,
      now: NOW,
    })
    const today = filterByPeriod(views, rangeForPreset('today', NOW))
    const statuses = new Set(today.map((v) => v.order.status))
    expect(today.length).toBeGreaterThan(15)
    expect(statuses.has('delivered')).toBe(true)
    expect(statuses.has('out_for_delivery') || statuses.has('awaiting_courier')).toBe(true)
    expect(views.some((v) => v.isDispatchLate)).toBe(true)

    const m = computeMetrics(today)
    expect(m.freightResult).toBeCloseTo(m.freightRevenue - m.deliveryCost, 2)
  })
})
