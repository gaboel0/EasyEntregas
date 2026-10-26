<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Bike,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Hourglass,
  Navigation,
  Receipt,
  Timer,
  TrendingUp,
  TriangleAlert,
} from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppButton from '@/components/ui/AppButton.vue'
import BarChart from '@/components/charts/BarChart.vue'
import StatusDistribution from '@/components/charts/StatusDistribution.vue'
import OrdersTable from '@/components/orders/OrdersTable.vue'
import ActivityFeed from '@/components/orders/ActivityFeed.vue'
import { CHART_COLORS } from '@/components/charts/chartColors'
import { useOrdersStore } from '@/stores/orders'
import { useFleetStore } from '@/stores/fleet'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from '@/composables/useNow'
import { byHour, computeMetrics, countByStatus, filterByPeriod } from '@/modules/reports/metrics'
import { rangeForPreset } from '@/utils/date'
import { formatCurrency, formatDuration, formatInteger, formatPercent, formatTime } from '@/utils/format'

const orders = useOrdersStore()
const fleet = useFleetStore()
const session = useSessionStore()
const settings = useSettingsStore()
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

const recent = computed(() => orders.views.slice(0, 8))
const lateOrders = computed(() => orders.views.filter((v) => v.isDispatchLate))

const greeting = computed(() => {
  const h = now.value.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
})

const todayLabel = computed(() => now.value.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
</script>

<template>
  <div>
    <PageHeader :title="`${greeting}, ${session.user?.name.split(' ')[0]}`" :description="`Operação de ${todayLabel} · atualizado às ${formatTime(now.toISOString())}`" />

    <RouterLink
      v-if="lateOrders.length"
      :to="{ name: 'dispatch' }"
      class="mb-5 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100"
      role="alert"
    >
      <TriangleAlert :size="18" class="shrink-0 text-amber-600" aria-hidden="true" />
      <span class="flex-1">
        <strong>{{ lateOrders.length }} {{ lateOrders.length === 1 ? 'pedido pronto aguarda' : 'pedidos prontos aguardam' }} despacho</strong>
        há mais de {{ settings.settings?.dispatchAlertMinutes }} min.
      </span>
      <span class="font-medium whitespace-nowrap">Abrir despacho →</span>
    </RouterLink>

    <section aria-label="Indicadores da operação" class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KpiCard label="Pedidos hoje" :value="formatInteger(metrics.orders)" :icon="ClipboardList" :hint="`${metrics.cancelled} cancelado(s)`" :to="{ name: 'orders', query: { period: 'today' } }" />
      <KpiCard
        label="Aguardando motoboy"
        :value="formatInteger(live.awaitingDispatch)"
        :icon="Hourglass"
        :tone="live.lateDispatch ? 'warning' : 'neutral'"
        :hint="live.lateDispatch ? `${live.lateDispatch} acima do tempo limite` : 'sem motoboy atribuído'"
        definition="Pedidos ainda não despachados e sem motoboy atribuído."
        :to="{ name: 'dispatch' }"
      />
      <KpiCard label="Em rota agora" :value="formatInteger(live.outForDelivery)" :icon="Navigation" tone="info" hint="saíram para entrega" :to="{ name: 'orders', query: { status: 'out_for_delivery', period: 'all' } }" />
      <KpiCard
        label="Entregues hoje"
        :value="formatInteger(metrics.delivered)"
        :icon="CircleCheck"
        tone="success"
        :hint="metrics.failedOpen ? `${metrics.failedOpen} falha(s) pendente(s)` : 'sem falhas pendentes'"
        :to="{ name: 'orders', query: { status: 'delivered', period: 'today' } }"
      />
      <KpiCard
        label="Motoboys disponíveis"
        :value="`${availableCouriers} de ${onShift}`"
        :icon="Bike"
        hint="em turno, sem entrega em rota"
        :to="{ name: 'couriers', query: { status: 'available' } }"
      />
      <KpiCard
        label="Fretes cobrados"
        :value="formatCurrency(metrics.freightRevenue)"
        :icon="Receipt"
        hint="de pedidos entregues hoje"
        definition="Soma do frete dos pedidos entregues hoje. Não inclui o valor dos produtos."
        :to="{ name: 'reports' }"
      />
      <KpiCard
        label="Custo estimado das entregas"
        :value="formatCurrency(metrics.deliveryCost)"
        :icon="CircleDollarSign"
        :hint="`remuneração ${formatCurrency(metrics.courierPay)}`"
        definition="Combustível, custos variáveis e remuneração das entregas encerradas hoje (estimativa)."
        :to="{ name: 'reports' }"
      />
      <KpiCard
        label="Resultado dos fretes"
        :value="formatCurrency(metrics.freightResult)"
        :icon="TrendingUp"
        :tone="metrics.freightResult < 0 ? 'danger' : 'success'"
        :hint="metrics.marginPct === null ? 'sem fretes cobrados' : `margem ${formatPercent(metrics.marginPct)}`"
        definition="Fretes cobrados menos o custo estimado das entregas. Estimativa operacional."
        :to="{ name: 'reports' }"
      />
      <KpiCard
        label="Tempo médio de entrega"
        :value="formatDuration(metrics.avgDeliveryMinutes)"
        :icon="Timer"
        :hint="`em rota: ${formatDuration(metrics.avgRouteMinutes)}`"
        definition="Do registro do pedido até a confirmação da entrega."
        :to="{ name: 'orders', query: { status: 'delivered', period: 'today' } }"
      />
      <KpiCard
        label="Taxa de conclusão"
        :value="formatPercent(metrics.completionRate)"
        :icon="Gauge"
        :hint="`${metrics.delivered} de ${metrics.delivered + metrics.cancelled + metrics.failedOpen} finalizados`"
        definition="Entregues ÷ (entregues + cancelados + falhas pendentes) dos pedidos de hoje."
        :to="{ name: 'reports' }"
      />
    </section>

    <div class="mt-5 grid gap-5 xl:grid-cols-3">
      <section class="card xl:col-span-2" aria-labelledby="chart-hour">
        <div class="card-header">
          <h2 id="chart-hour" class="card-title">Pedidos recebidos por hora (hoje)</h2>
          <span class="text-xs text-slate-500">{{ metrics.orders }} pedidos</span>
        </div>
        <div class="p-4">
          <BarChart
            v-if="metrics.orders"
            :labels="hourly.labels"
            :series="[{ label: 'Pedidos', data: hourly.data, color: CHART_COLORS.revenue }]"
            :format="(v) => formatInteger(v)"
            :summary="`Pedidos por hora hoje: ${hourly.labels.map((l, i) => `${l}: ${hourly.data[i]}`).join(', ')}`"
          />
          <EmptyState v-else title="Nenhum pedido recebido hoje" description="Cadastre um pedido para acompanhar a operação em tempo real.">
            <AppButton v-if="session.can('orders.create')" variant="primary" :to="{ name: 'order-new' }">Cadastrar pedido</AppButton>
          </EmptyState>
        </div>
      </section>

      <section class="card" aria-labelledby="chart-status">
        <div class="card-header">
          <h2 id="chart-status" class="card-title">Pedidos de hoje por status</h2>
        </div>
        <div class="p-3">
          <StatusDistribution :counts="statusCounts" />
        </div>
      </section>
    </div>

    <div class="mt-5 grid gap-5 xl:grid-cols-3">
      <section class="card overflow-hidden xl:col-span-2" aria-labelledby="recent-orders">
        <div class="card-header">
          <h2 id="recent-orders" class="card-title">Pedidos recentes</h2>
          <RouterLink :to="{ name: 'orders' }" class="text-xs font-medium text-brand-600 hover:text-brand-700">Ver todos →</RouterLink>
        </div>
        <OrdersTable v-if="recent.length" :views="recent" compact />
        <EmptyState v-else title="Nenhum pedido cadastrado" />
      </section>

      <section class="card" aria-labelledby="activity">
        <div class="card-header">
          <h2 id="activity" class="card-title">Atividade recente</h2>
        </div>
        <div class="max-h-[30rem] overflow-y-auto p-4">
          <ActivityFeed />
        </div>
      </section>
    </div>
  </div>
</template>
