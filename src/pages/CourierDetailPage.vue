<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { ArrowLeft, Pencil, Phone, SearchX } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import CourierStatusBadge from '@/components/ui/CourierStatusBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import CourierFormModal from '@/components/couriers/CourierFormModal.vue'
import { useFleetStore } from '@/stores/fleet'
import { useCouriersStore } from '@/stores/couriers'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import { useNow } from '@/composables/useNow'
import { byCourier, filterByPeriod } from '@/modules/reports/metrics'
import { COMPENSATION_MODEL_LABEL, LINK_TYPE_LABEL, VEHICLE_TYPE_LABEL, describeCompensation } from '@/modules/couriers/courierLabels'
import { rangeForPreset } from '@/utils/date'
import { formatCurrency, formatDate, formatDateTime, formatDuration, formatKm, formatOrderNumber, formatPhone, minutesBetween, onlyDigits } from '@/utils/format'
import { errorMessage } from '@/services'

const route = useRoute()
const fleet = useFleetStore()
const couriers = useCouriersStore()
const orders = useOrdersStore()
const session = useSessionStore()
const toast = useToast()
const now = useNow()

const view = computed(() => fleet.viewById.get(String(route.params.id)) ?? null)
const editOpen = ref(false)

type Period = 'today' | 'last7' | 'last30' | 'all'
const period = ref<Period>('last30')
const periodOptions = [
  { value: 'today' as Period, label: 'Hoje' },
  { value: 'last7' as Period, label: '7 dias' },
  { value: 'last30' as Period, label: '30 dias' },
  { value: 'all' as Period, label: 'Tudo' },
]

const periodViews = computed(() => (period.value === 'all' ? orders.views : filterByPeriod(orders.views, rangeForPreset(period.value, now.value))))
const stats = computed(() => {
  const id = view.value?.profile.id
  return byCourier(periodViews.value, couriers.couriers).find((r) => r.courierId === id) ?? null
})

/** Tentativas de entrega deste motoboy no período, da mais recente para a mais antiga. */
const attempts = computed(() => {
  const id = view.value?.profile.id
  if (!id) return []
  return periodViews.value
    .flatMap((v) => v.deliveries.filter((d) => d.courierId === id).map((d) => ({ view: v, delivery: d })))
    .sort((a, b) => (b.delivery.assignedAt ?? b.delivery.createdAt).localeCompare(a.delivery.assignedAt ?? a.delivery.createdAt))
})

const DELIVERY_STATUS_LABEL = {
  unassigned: 'Sem motoboy',
  assigned: 'Aguardando saída',
  in_transit: 'Em rota',
  delivered: 'Entregue',
  failed: 'Falhou',
  cancelled: 'Cancelada',
} as const

const toggling = ref(false)
async function toggleShift() {
  if (!view.value) return
  toggling.value = true
  const next = view.value.profile.link.shiftStatus === 'available' ? 'unavailable' : 'available'
  try {
    await couriers.setShiftStatus(view.value.profile.id, next)
    toast.success(next === 'available' ? 'Turno iniciado' : 'Turno encerrado')
  } catch (e) {
    toast.error('Não foi possível alterar a disponibilidade', errorMessage(e))
  } finally {
    toggling.value = false
  }
}
</script>

<template>
  <div v-if="!view" class="card">
    <EmptyState :icon="SearchX" title="Motoboy não encontrado" description="Ele não está vinculado a este estabelecimento.">
      <AppButton :to="{ name: 'couriers' }">Voltar para motoboys</AppButton>
    </EmptyState>
  </div>
  <div v-else>
    <PageHeader :title="view.profile.name">
      <template #eyebrow>
        <RouterLink :to="{ name: 'couriers' }" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft :size="13" aria-hidden="true" /> Motoboys
        </RouterLink>
        <div class="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <CourierStatusBadge :status="view.status" :overloaded="view.overloaded" />
          <span>{{ view.profile.link.internalCode }} · {{ LINK_TYPE_LABEL[view.profile.link.linkType] }} · vinculado desde {{ formatDate(view.profile.link.createdAt) }}</span>
        </div>
      </template>
      <template #actions>
        <AppButton
          v-if="session.can('dispatch.assign')"
          :loading="toggling"
          :disabled="view.status === 'busy'"
          :title="view.status === 'busy' ? 'Conclua as entregas em rota antes de encerrar o turno' : undefined"
          @click="toggleShift"
        >
          {{ view.profile.link.shiftStatus === 'available' ? 'Encerrar turno' : 'Iniciar turno' }}
        </AppButton>
        <AppButton v-if="session.can('couriers.manage')" variant="primary" :icon="Pencil" @click="editOpen = true">Editar</AppButton>
      </template>
    </PageHeader>

    <div class="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside class="space-y-5">
        <section class="card" aria-labelledby="c-data">
          <div class="card-header"><h2 id="c-data" class="card-title">Dados do entregador</h2></div>
          <dl class="space-y-2.5 p-4 text-sm">
            <div>
              <dt class="text-xs text-slate-500">Telefone</dt>
              <dd>
                <a :href="`tel:+55${onlyDigits(view.profile.phone)}`" class="tabular inline-flex items-center gap-1 text-brand-700 hover:underline">
                  <Phone :size="13" aria-hidden="true" />{{ formatPhone(view.profile.phone) }}
                </a>
              </dd>
            </div>
            <div><dt class="text-xs text-slate-500">Remuneração</dt><dd>{{ COMPENSATION_MODEL_LABEL[view.profile.link.compensation.model] }} — {{ describeCompensation(view.profile.link.compensation) }}</dd></div>
            <div>
              <dt class="text-xs text-slate-500">Veículo</dt>
              <dd>
                {{ VEHICLE_TYPE_LABEL[view.profile.vehicle.type] }}<template v-if="view.profile.vehicle.model"> · {{ view.profile.vehicle.model }}</template>
                <template v-if="view.profile.vehicle.plate"> · {{ view.profile.vehicle.plate }}</template>
                <template v-if="view.profile.vehicle.consumptionKmPerLiter"> · {{ view.profile.vehicle.consumptionKmPerLiter }} km/l</template>
              </dd>
            </div>
            <div><dt class="text-xs text-slate-500">Custos do veículo</dt><dd>{{ view.profile.link.vehicleCostsPaidByEstablishment ? 'Pagos pelo estabelecimento' : 'Por conta do motoboy' }}</dd></div>
            <div v-if="view.profile.link.notes"><dt class="text-xs text-slate-500">Observações</dt><dd class="text-slate-700">{{ view.profile.link.notes }}</dd></div>
          </dl>
        </section>
        <section class="card" aria-labelledby="c-now">
          <div class="card-header"><h2 id="c-now" class="card-title">Agora</h2></div>
          <ul v-if="view.activeDeliveries.length" class="divide-y divide-slate-100">
            <li v-for="d in view.activeDeliveries" :key="d.id" class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <RouterLink :to="{ name: 'order-detail', params: { id: d.orderId } }" class="font-medium text-slate-900 hover:text-brand-700">
                {{ formatOrderNumber(orders.viewById.get(d.orderId)?.order.number ?? 0) }} · {{ orders.viewById.get(d.orderId)?.order.address.district }}
              </RouterLink>
              <span class="tabular text-xs text-slate-500">{{ d.status === 'in_transit' && d.dispatchedAt ? `em rota há ${formatDuration(minutesBetween(d.dispatchedAt, now))}` : 'aguardando saída' }}</span>
            </li>
          </ul>
          <p v-else class="px-4 py-5 text-center text-sm text-slate-500">Nenhuma entrega ativa.</p>
        </section>
      </aside>

      <div class="space-y-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-slate-900">Desempenho</h2>
          <SegmentedControl v-model="period" :options="periodOptions" label="Período" size="sm" />
        </div>
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Entregas concluídas" :value="String(stats?.delivered ?? 0)" :hint="`${stats?.failed ?? 0} falha(s)`" />
          <KpiCard label="Tempo médio em rota" :value="formatDuration(stats?.avgRouteMinutes)" hint="saída → entrega" />
          <KpiCard label="Remuneração acumulada" :value="formatCurrency(stats?.courierPay ?? 0)" :hint="`${formatKm(stats?.distanceKm ?? 0)} percorridos (estimado)`" definition="Soma estimada da remuneração variável pelas entregas encerradas." />
          <KpiCard
            label="Resultado dos fretes"
            :value="formatCurrency(stats?.result ?? 0)"
            :tone="(stats?.result ?? 0) < 0 ? 'danger' : 'success'"
            :hint="`fretes ${formatCurrency(stats?.freightRevenue ?? 0)} − custo ${formatCurrency(stats?.deliveryCost ?? 0)}`"
          />
        </div>

        <section class="card overflow-hidden" aria-labelledby="c-history">
          <div class="card-header"><h2 id="c-history" class="card-title">Histórico de entregas</h2><span class="text-xs text-slate-500">{{ attempts.length }} no período</span></div>
          <div v-if="attempts.length" class="max-h-[32rem] overflow-auto">
            <table class="table-base">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Data</th>
                  <th scope="col">Entrega</th>
                  <th scope="col">Pedido agora</th>
                  <th scope="col" class="text-right">Distância</th>
                  <th scope="col" class="text-right">Em rota</th>
                  <th scope="col" class="text-right">Remuneração</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="{ view: v, delivery: d } in attempts" :key="d.id">
                  <td>
                    <RouterLink :to="{ name: 'order-detail', params: { id: v.order.id } }" class="font-medium text-slate-900 hover:text-brand-700">{{ formatOrderNumber(v.order.number) }}</RouterLink>
                    <p class="text-xs text-slate-500">{{ v.order.address.district }}</p>
                  </td>
                  <td class="tabular whitespace-nowrap text-slate-600">{{ formatDateTime(d.assignedAt ?? d.createdAt) }}</td>
                  <td class="text-xs whitespace-nowrap" :class="d.status === 'failed' ? 'text-rose-700' : 'text-slate-700'">{{ DELIVERY_STATUS_LABEL[d.status] }}</td>
                  <td><StatusBadge :status="v.order.status" /></td>
                  <td class="tabular text-right">{{ formatKm(d.costSnapshot?.distanceUsedKm ?? v.order.address.distanceKm) }}</td>
                  <td class="tabular text-right">{{ d.dispatchedAt && d.completedAt ? formatDuration(minutesBetween(d.dispatchedAt, d.completedAt)) : '—' }}</td>
                  <td class="tabular text-right">{{ d.costSnapshot ? formatCurrency(d.costSnapshot.courierPay) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <EmptyState v-else compact title="Nenhuma entrega no período" />
        </section>
      </div>
    </div>

    <CourierFormModal :open="editOpen" :courier="view.profile" @close="editOpen = false" />
  </div>
</template>
