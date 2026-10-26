<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CircleCheck, Navigation, Route as RouteIcon, UserCheck } from 'lucide-vue-next'
import type { CourierStatus } from '@/types/domain'
import type { OrderView } from '@/modules/orders/orderViews'
import PageHeader from '@/components/ui/PageHeader.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import CourierStatusBadge from '@/components/ui/CourierStatusBadge.vue'
import DispatchOrderCard from '@/components/deliveries/DispatchOrderCard.vue'
import AssignCourierModal from '@/components/deliveries/AssignCourierModal.vue'
import { useOrdersStore } from '@/stores/orders'
import { useFleetStore } from '@/stores/fleet'
import { useCouriersStore } from '@/stores/couriers'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import { useNow } from '@/composables/useNow'
import { PRE_DISPATCH_STATUSES } from '@/modules/orders/orderWorkflow'
import { formatCurrency, formatDuration, formatPercent, minutesBetween } from '@/utils/format'
import { sum } from '@/utils/number'
import { errorMessage } from '@/services'

const orders = useOrdersStore()
const fleet = useFleetStore()
const couriers = useCouriersStore()
const settings = useSettingsStore()
const session = useSessionStore()
const toast = useToast()
const now = useNow()

const byWaiting = (a: OrderView, b: OrderView) =>
  Number(b.isDispatchLate) - Number(a.isDispatchLate) ||
  (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1) ||
  a.order.createdAt.localeCompare(b.order.createdAt)

const queue = computed(() => orders.views.filter((v) => PRE_DISPATCH_STATUSES.includes(v.order.status) && v.order.fulfillment !== 'pickup' && !v.delivery?.courierId).sort(byWaiting))
const assigned = computed(() => orders.views.filter((v) => PRE_DISPATCH_STATUSES.includes(v.order.status) && v.order.fulfillment !== 'pickup' && !!v.delivery?.courierId).sort(byWaiting))
const failed = computed(() => orders.views.filter((v) => v.order.status === 'delivery_failed'))
const inTransit = computed(() =>
  orders.views
    .filter((v) => v.order.status === 'out_for_delivery')
    .sort((a, b) => (a.delivery?.dispatchedAt ?? '').localeCompare(b.delivery?.dispatchedAt ?? '')),
)

const active = computed(() => [...queue.value, ...assigned.value, ...inTransit.value])
const economics = computed(() => {
  const freight = sum(active.value.map((v) => v.order.freightFee))
  const cost = sum(active.value.map((v) => v.economics.operationalCost))
  return { freight, cost, result: freight - cost, margin: freight > 0 ? ((freight - cost) / freight) * 100 : null }
})

type CourierFilter = 'all' | CourierStatus | 'overloaded'
const courierFilter = ref<CourierFilter>('all')
const courierOptions = computed(() => [
  { value: 'all' as CourierFilter, label: 'Todos', count: fleet.views.length },
  { value: 'available' as CourierFilter, label: 'Disponíveis', count: fleet.views.filter((c) => c.status === 'available').length },
  { value: 'busy' as CourierFilter, label: 'Ocupados', count: fleet.views.filter((c) => c.status === 'busy').length },
  { value: 'overloaded' as CourierFilter, label: 'No limite', count: fleet.views.filter((c) => c.overloaded && c.status !== 'unavailable').length },
  { value: 'unavailable' as CourierFilter, label: 'Indisponíveis', count: fleet.views.filter((c) => c.status === 'unavailable').length },
])
const STATUS_ORDER = { available: 0, busy: 1, unavailable: 2 } as const
const filteredCouriers = computed(() =>
  fleet.views
    .filter((c) =>
      courierFilter.value === 'all'
        ? true
        : courierFilter.value === 'overloaded'
          ? c.overloaded && c.status !== 'unavailable'
          : c.status === courierFilter.value,
    )
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.activeDeliveries.length - b.activeDeliveries.length),
)

const deliveredToday = computed(() => {
  const today = now.value.toDateString()
  const map = new Map<string, number>()
  for (const d of orders.deliveries) {
    if (d.status === 'delivered' && d.courierId && d.completedAt && new Date(d.completedAt).toDateString() === today) {
      map.set(d.courierId, (map.get(d.courierId) ?? 0) + 1)
    }
  }
  return map
})

const assignTarget = ref<OrderView | null>(null)
const togglingShift = ref<string | null>(null)

async function toggleShift(courierId: string, available: boolean) {
  togglingShift.value = courierId
  try {
    const p = await couriers.setShiftStatus(courierId, available ? 'available' : 'unavailable')
    toast.success(`${p.name} agora está ${available ? 'disponível' : 'indisponível'}`)
  } catch (e) {
    toast.error('Não foi possível alterar a disponibilidade', errorMessage(e))
  } finally {
    togglingShift.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader title="Despacho" description="Distribua os pedidos entre os motoboys e acompanhe as entregas em andamento." />

    <section aria-label="Resumo do despacho" class="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
      <div>
        <p class="text-xs text-slate-500">Aguardando atribuição</p>
        <p class="tabular mt-1 text-xl font-semibold" :class="queue.some((v) => v.isDispatchLate) ? 'text-amber-700' : 'text-slate-900'">{{ queue.length }}</p>
        <p class="text-xs text-slate-500">{{ queue.filter((v) => v.isDispatchLate).length }} acima de {{ settings.settings?.dispatchAlertMinutes }} min</p>
      </div>
      <div>
        <p class="text-xs text-slate-500">Atribuídos, aguardando saída</p>
        <p class="tabular mt-1 text-xl font-semibold text-slate-900">{{ assigned.length }}</p>
      </div>
      <div>
        <p class="text-xs text-slate-500">Em rota</p>
        <p class="tabular mt-1 text-xl font-semibold text-slate-900">{{ inTransit.length }}</p>
      </div>
      <div>
        <p class="text-xs text-slate-500">Fretes em aberto</p>
        <p class="tabular mt-1 text-xl font-semibold text-slate-900">{{ formatCurrency(economics.freight) }}</p>
        <p class="text-xs text-slate-500">pedidos ainda não entregues</p>
      </div>
      <div>
        <p class="text-xs text-slate-500">Custo estimado</p>
        <p class="tabular mt-1 text-xl font-semibold text-slate-900">{{ formatCurrency(economics.cost) }}</p>
      </div>
      <div>
        <p class="text-xs text-slate-500">Margem estimada</p>
        <p class="tabular mt-1 text-xl font-semibold" :class="economics.result < 0 ? 'text-rose-700' : 'text-emerald-700'">{{ formatPercent(economics.margin) }}</p>
        <p class="tabular text-xs text-slate-500">resultado {{ formatCurrency(economics.result) }}</p>
      </div>
    </section>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_22rem]">
      <section class="card flex flex-col" aria-labelledby="q-title">
        <div class="card-header">
          <h2 id="q-title" class="card-title">Aguardando atribuição</h2>
          <span class="tabular text-xs text-slate-500">{{ queue.length }}</span>
        </div>
        <div class="p-1.5">
          <DispatchOrderCard v-for="v in queue" :key="v.order.id" :view="v" mode="queue" @assign="assignTarget = $event" />
          <EmptyState v-if="!queue.length" compact :icon="CircleCheck" title="Nenhum pedido sem motoboy" description="Todos os pedidos em andamento já têm entregador definido." />
        </div>
        <template v-if="failed.length">
          <div class="card-header border-t"><h3 class="card-title text-rose-700">Falhas aguardando decisão</h3></div>
          <div class="p-1.5">
            <DispatchOrderCard v-for="v in failed" :key="v.order.id" :view="v" mode="assigned" @assign="assignTarget = $event" />
          </div>
        </template>
      </section>

      <div class="space-y-5">
        <section class="card" aria-labelledby="a-title">
          <div class="card-header">
            <h2 id="a-title" class="card-title">Atribuídos · aguardando saída</h2>
            <span class="tabular text-xs text-slate-500">{{ assigned.length }}</span>
          </div>
          <div class="p-1.5">
            <DispatchOrderCard v-for="v in assigned" :key="v.order.id" :view="v" mode="assigned" @assign="assignTarget = $event" />
            <EmptyState v-if="!assigned.length" compact :icon="UserCheck" title="Nenhum pedido aguardando saída" />
          </div>
        </section>
        <section class="card" aria-labelledby="t-title">
          <div class="card-header">
            <h2 id="t-title" class="card-title">Em rota</h2>
            <span class="tabular text-xs text-slate-500">{{ inTransit.length }}</span>
          </div>
          <div class="p-1.5">
            <DispatchOrderCard v-for="v in inTransit" :key="v.order.id" :view="v" mode="transit" />
            <EmptyState v-if="!inTransit.length" compact :icon="Navigation" title="Nenhuma entrega em rota" />
          </div>
        </section>
      </div>

      <section class="card self-start" aria-labelledby="c-title">
        <div class="card-header">
          <h2 id="c-title" class="card-title">Motoboys</h2>
          <RouterLink :to="{ name: 'couriers' }" class="text-xs font-medium text-brand-600 hover:text-brand-700">Gerenciar</RouterLink>
        </div>
        <div class="border-b border-slate-100 p-3">
          <SegmentedControl v-model="courierFilter" :options="courierOptions" label="Filtrar motoboys" size="sm" />
        </div>
        <ul class="divide-y divide-slate-100">
          <li v-for="c in filteredCouriers" :key="c.profile.id" class="px-3 py-2.5">
            <div class="flex items-center justify-between gap-2">
              <RouterLink :to="{ name: 'courier-detail', params: { id: c.profile.id } }" class="truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                {{ c.profile.name }}
              </RouterLink>
              <CourierStatusBadge :status="c.status" :overloaded="c.overloaded" />
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              <div
                class="flex h-1.5 flex-1 gap-0.5"
                role="meter"
                :aria-valuenow="c.activeDeliveries.length"
                :aria-valuemax="settings.settings?.maxConcurrentDeliveriesPerCourier"
                :aria-label="`Carga de ${c.profile.name}`"
              >
                <span
                  v-for="n in settings.settings?.maxConcurrentDeliveriesPerCourier ?? 3"
                  :key="n"
                  class="flex-1 rounded-full"
                  :class="n <= c.activeDeliveries.length ? (c.overloaded ? 'bg-amber-500' : 'bg-brand-500') : 'bg-slate-200'"
                />
              </div>
              <span class="tabular text-xs text-slate-500">{{ c.activeDeliveries.length }}/{{ settings.settings?.maxConcurrentDeliveriesPerCourier }}</span>
            </div>
            <div class="tabular mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>
                {{ deliveredToday.get(c.profile.id) ?? 0 }} entregue(s) hoje
                <template v-if="c.onRouteSince"> · em rota há {{ formatDuration(minutesBetween(c.onRouteSince, now)) }}</template>
              </span>
              <button
                v-if="session.can('dispatch.assign')"
                type="button"
                class="font-medium text-brand-600 hover:text-brand-800 disabled:opacity-50"
                :disabled="togglingShift === c.profile.id || (c.status === 'busy')"
                :title="c.status === 'busy' ? 'Conclua as entregas em rota antes de encerrar o turno' : undefined"
                @click="toggleShift(c.profile.id, c.profile.link.shiftStatus !== 'available')"
              >
                {{ c.profile.link.shiftStatus === 'available' ? 'Encerrar turno' : 'Iniciar turno' }}
              </button>
            </div>
          </li>
          <li v-if="!filteredCouriers.length" class="px-3 py-6 text-center text-sm text-slate-500">Nenhum motoboy neste filtro.</li>
        </ul>
        <div class="flex gap-2 border-t border-slate-100 bg-slate-100/50 p-3 text-xs text-slate-500">
          <RouteIcon :size="14" class="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Otimização automática de rotas ainda não está ativa: requer um serviço de roteamento conectado ao backend. A distribuição é feita manualmente.
          </p>
        </div>
      </section>
    </div>

    <AssignCourierModal :open="!!assignTarget" :view="assignTarget" @close="assignTarget = null" />
  </div>
</template>
