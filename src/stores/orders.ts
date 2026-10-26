import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Delivery, ID, Order, OrderHistoryEntry } from '@/types/domain'
import { dataSource, type OrderAggregate, type StatusChangeRequest } from '@/services'
import type { OrderInput } from '@/modules/orders/orderSchema'
import { buildOrderViews, type OrderView } from '@/modules/orders/orderViews'
import { useNow, tickNow } from '@/composables/useNow'
import { useCouriersStore } from './couriers'
import { useSettingsStore } from './settings'

export const useOrdersStore = defineStore('orders', () => {
  // shallowRef: as coleções são substituídas por inteiro a cada mutação (imutabilidade simples).
  const orders = shallowRef<Order[]>([])
  const deliveries = shallowRef<Delivery[]>([])
  const history = shallowRef<OrderHistoryEntry[]>([])
  const now = useNow()

  async function load() {
    const snapshot = await dataSource.orders.list()
    orders.value = snapshot.orders
    deliveries.value = snapshot.deliveries
    history.value = snapshot.history
  }

  function apply(aggregate: OrderAggregate): Order {
    const id = aggregate.order.id
    const exists = orders.value.some((o) => o.id === id)
    orders.value = exists ? orders.value.map((o) => (o.id === id ? aggregate.order : o)) : [...orders.value, aggregate.order]
    deliveries.value = [...deliveries.value.filter((d) => d.orderId !== id), ...aggregate.deliveries]
    history.value = [...history.value.filter((h) => h.orderId !== id), ...aggregate.history]
    tickNow()
    return aggregate.order
  }

  const views = computed<OrderView[]>(() => {
    const settings = useSettingsStore().settings
    if (!settings) return []
    return buildOrderViews({
      orders: orders.value,
      deliveries: deliveries.value,
      history: history.value,
      couriers: useCouriersStore().couriers,
      settings,
      now: now.value,
    }).sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt))
  })

  const viewById = computed(() => new Map(views.value.map((v) => [v.order.id, v])))

  return {
    orders,
    deliveries,
    history,
    views,
    viewById,
    load,
    create: async (input: OrderInput) => apply(await dataSource.orders.create(input)),
    update: async (id: ID, input: OrderInput) => apply(await dataSource.orders.update(id, input)),
    changeStatus: async (id: ID, request: StatusChangeRequest) => apply(await dataSource.orders.changeStatus(id, request)),
    assignCourier: async (id: ID, courierId: ID) => apply(await dataSource.orders.assignCourier(id, courierId)),
    unassignCourier: async (id: ID) => apply(await dataSource.orders.unassignCourier(id)),
  }
})
