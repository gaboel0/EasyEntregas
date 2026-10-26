<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronDown } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BarChart from '@/components/charts/BarChart.vue'
import StatusDistribution from '@/components/charts/StatusDistribution.vue'
import ActivityFeed from '@/components/orders/ActivityFeed.vue'
import { CHART_COLORS } from '@/components/charts/chartColors'
import { useOrdersStore } from '@/stores/orders'
import { useFleetStore } from '@/stores/fleet'
import { useNow } from '@/composables/useNow'
import { byHour, computeMetrics, countByStatus, filterByPeriod } from '@/modules/reports/metrics'
import { rangeForPreset } from '@/utils/date'
import { formatCurrency, formatDuration, formatInteger, formatPercent } from '@/utils/format'

const orders = useOrdersStore()
const fleet = useFleetStore()
const now = useNow()

const today = computed(() => filterByPeriod(orders.views, rangeForPreset('today', now.value)))
const metrics = computed(() => computeMetrics(today.value))
/** Situação atual da operação (inclui pedidos de ontem ainda em andamento). */
const live = computed(() => computeMetrics(orders.views))
const statusCounts = computed(() => countByStatus(today.value))

const availableCouriers = computed(() => fleet.views.filter((c) => c.status === 'available').length)
const onShift = computed(() => fleet.views.filter((c) => c.status !== 'unavailable').length)

const hourly = computed(() => {
  const counts = byHour(today.value)
  const used = counts.map((c, h) => (c > 0 ? h : -1)).filter((h) => h >= 0)
  const start = used.length ? Math.min(...used) : now.value.getHours()
  const end = Math.max(now.value.getHours(), used.length ? Math.max(...used) : 0)
  const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  return { labels: hours.map((h) => `${h}h`), data: hours.map((h) => counts[h] ?? 0) }
})

interface Stat {
  label: string
  value: string
  hint?: string
  to?: RouteLocationRaw
  tone?: 'warning' | 'danger' | 'success'
}

/** Indicadores operacionais: poucos, sem ícones nem caixas, para leitura rápida. */
const primary = computed<Stat[]>(() => [
  { label: 'Pedidos hoje', value: formatInteger(metrics.value.orders), hint: metrics.value.cancelled ? `${metrics.value.cancelled} cancelado(s)` : undefined, to: { name: 'orders', query: { period: 'today' } } },
  { label: 'Aguardando motoboy', value: formatInteger(live.value.awaitingDispatch), hint: live.value.lateDispatch ? `${live.value.lateDispatch} acima do limite` : undefined, tone: live.value.lateDispatch ? 'warning' : undefined, to: { name: 'dispatch' } },
  { label: 'Em rota', value: formatInteger(live.value.outForDelivery), to: { name: 'orders', query: { status: 'out_for_delivery', period: 'all' } } },
  { label: 'Entregues hoje', value: formatInteger(metrics.value.delivered), hint: metrics.value.failedOpen ? `${metrics.value.failedOpen} falha(s) pendente(s)` : undefined, tone: metrics.value.failedOpen ? 'danger' : undefined, to: { name: 'orders', query: { status: 'delivered', period: 'today' } } },
  { label: 'Motoboys livres', value: `${availableCouriers.value} de ${onShift.value}`, hint: 'em turno', to: { name: 'couriers', query: { status: 'available' } } },
])

const financial = computed<Stat[]>(() => [
  { label: 'Fretes cobrados', value: formatCurrency(metrics.value.freightRevenue), hint: 'pedidos entregues hoje', to: { name: 'reports' } },
  { label: 'Custo estimado', value: formatCurrency(metrics.value.deliveryCost), hint: `remuneração ${formatCurrency(metrics.value.courierPay)}`, to: { name: 'reports' } },
  { label: 'Resultado dos fretes', value: formatCurrency(metrics.value.freightResult), hint: metrics.value.marginPct === null ? undefined : `margem ${formatPercent(metrics.value.marginPct)}`, tone: metrics.value.freightResult < 0 ? 'danger' : 'success', to: { name: 'reports' } },
  { label: 'Tempo médio de entrega', value: formatDuration(metrics.value.avgDeliveryMinutes), hint: `em rota ${formatDuration(metrics.value.avgRouteMinutes)}` },
  { label: 'Taxa de conclusão', value: formatPercent(metrics.value.completionRate), hint: 'entregues ÷ finalizados' },
])

const TONE = { warning: 'text-amber-700', danger: 'text-rose-700', success: 'text-emerald-700' }

// Detalhes financeiros ficam recolhidos por padrão; a escolha é lembrada neste navegador.
const SHOW_KEY = 'rotacerta:dashboard-financial'
const readFlag = () => {
  try {
    return localStorage.getItem(SHOW_KEY) === 'true'
  } catch {
    return false
  }
}
const showFinancial = ref(readFlag())
watch(showFinancial, (v) => {
  try {
    localStorage.setItem(SHOW_KEY, String(v))
  } catch {
    /* preferência vale só nesta sessão */
  }
})

type Panel = 'hour' | 'status' | 'activity'
const panel = ref<Panel>('hour')
const panels = [
  { value: 'hour' as Panel, label: 'Pedidos por hora' },
  { value: 'status' as Panel, label: 'Por status' },
  { value: 'activity' as Panel, label: 'Atividade' },
]
</script>

<template>
  <div class="space-y-8">
    <PageHeader title="Análise" description="Indicadores e gráficos do dia. Para acompanhar a operação em tempo real, use a visão geral." class="!mb-0" />

    <section aria-label="Indicadores da operação">
      <dl class="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
        <component
          :is="stat.to ? RouterLink : 'div'"
          v-for="stat in primary"
          :key="stat.label"
          :to="stat.to"
          class="-mx-2 rounded-lg px-2 py-1.5 transition-colors"
          :class="stat.to ? 'hover:bg-slate-100/60' : ''"
        >
          <dt class="text-xs text-slate-500">{{ stat.label }}</dt>
          <dd class="tabular mt-1 text-2xl font-semibold tracking-tight" :class="stat.tone ? TONE[stat.tone] : 'text-slate-900'">{{ stat.value }}</dd>
          <p v-if="stat.hint" class="mt-0.5 text-xs text-slate-500">{{ stat.hint }}</p>
        </component>
      </dl>

      <button
        type="button"
        class="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        :aria-expanded="showFinancial"
        aria-controls="financial-stats"
        @click="showFinancial = !showFinancial"
      >
        <ChevronDown :size="14" class="transition-transform" :class="{ '-rotate-90': !showFinancial }" aria-hidden="true" />
        Financeiro e desempenho
      </button>
      <dl v-if="showFinancial" id="financial-stats" class="mt-3 grid animate-fade-in grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
        <component
          :is="stat.to ? RouterLink : 'div'"
          v-for="stat in financial"
          :key="stat.label"
          :to="stat.to"
          class="-mx-2 rounded-lg px-2 py-1.5 transition-colors"
          :class="stat.to ? 'hover:bg-slate-100/60' : ''"
        >
          <dt class="text-xs text-slate-500">{{ stat.label }}</dt>
          <dd class="tabular mt-1 text-xl font-semibold tracking-tight" :class="stat.tone ? TONE[stat.tone] : 'text-slate-900'">{{ stat.value }}</dd>
          <p v-if="stat.hint" class="mt-0.5 text-xs text-slate-500">{{ stat.hint }}</p>
        </component>
      </dl>
    </section>

    <section class="card" aria-labelledby="analysis-title">
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <h2 id="analysis-title" class="text-sm font-semibold text-slate-900">Análise do dia</h2>
        <SegmentedControl v-model="panel" :options="panels" label="Painel de análise" size="sm" />
      </div>
      <div class="p-5">
        <template v-if="panel === 'hour'">
          <BarChart
            v-if="metrics.orders"
            :labels="hourly.labels"
            :series="[{ label: 'Pedidos', data: hourly.data, color: CHART_COLORS.revenue }]"
            :format="(v) => formatInteger(v)"
            :summary="`Pedidos por hora hoje: ${hourly.labels.map((l, i) => `${l}: ${hourly.data[i]}`).join(', ')}`"
          />
          <EmptyState v-else compact title="Nenhum pedido recebido hoje" />
        </template>
        <div v-else-if="panel === 'status'" class="mx-auto max-w-xl"><StatusDistribution :counts="statusCounts" /></div>
        <div v-else class="max-h-96 overflow-y-auto pr-2"><ActivityFeed /></div>
      </div>
    </section>
  </div>
</template>
