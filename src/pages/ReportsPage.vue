<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Download } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BarChart from '@/components/charts/BarChart.vue'
import { CHART_COLORS } from '@/components/charts/chartColors'
import { useOrdersStore } from '@/stores/orders'
import { useCouriersStore } from '@/stores/couriers'
import { useSessionStore } from '@/stores/session'
import { useNow } from '@/composables/useNow'
import { useToast } from '@/composables/useToast'
import { byCourier, byDay, bySource, computeMetrics, filterByPeriod } from '@/modules/reports/metrics'
import { ORDER_SOURCE_LABEL, PAYMENT_METHOD_LABEL } from '@/modules/orders/orderLabels'
import { ORDER_STATUS_LABEL } from '@/modules/orders/orderWorkflow'
import { endOfDay, fromDateInputValue, PERIOD_LABEL, rangeForPreset, startOfDay, toDateInputValue, type DateRange, type PeriodPreset } from '@/utils/date'
import { formatCurrency, formatDateTime, formatDuration, formatInteger, formatKm, formatPercent, formatShortDate } from '@/utils/format'
import { downloadCsv, toCsv } from '@/utils/csv'

const orders = useOrdersStore()
const couriers = useCouriersStore()
const session = useSessionStore()
const now = useNow()
const toast = useToast()

const preset = ref<PeriodPreset>('last7')
const customFrom = ref(toDateInputValue(rangeForPreset('last7').from))
const customTo = ref(toDateInputValue(new Date()))
const presetOptions = (['today', 'yesterday', 'last7', 'last30', 'custom'] as const).map((p) => ({ value: p as PeriodPreset, label: PERIOD_LABEL[p] }))

const range = computed<DateRange>(() => {
  if (preset.value !== 'custom') return rangeForPreset(preset.value, now.value)
  const from = fromDateInputValue(customFrom.value) ?? now.value
  const to = fromDateInputValue(customTo.value) ?? now.value
  return from <= to ? { from: startOfDay(from), to: endOfDay(to) } : { from: startOfDay(to), to: endOfDay(from) }
})

const views = computed(() => filterByPeriod(orders.views, range.value))
const metrics = computed(() => computeMetrics(views.value))
const days = computed(() => byDay(views.value, range.value))
const sources = computed(() => bySource(views.value).sort((a, b) => b.orders - a.orders))
const courierRows = computed(() => byCourier(views.value, couriers.couriers))
const maxSource = computed(() => Math.max(1, ...sources.value.map((s) => s.orders)))
const periodText = computed(() => `${formatShortDate(range.value.from)} a ${formatShortDate(range.value.to)}`)

function fileSuffix() {
  return `${toDateInputValue(range.value.from)}_a_${toDateInputValue(range.value.to)}`
}

function exportOrders() {
  const rows = views.value.map((v) => [
    v.order.number,
    formatDateTime(v.order.createdAt),
    ORDER_STATUS_LABEL[v.order.status],
    ORDER_SOURCE_LABEL[v.order.source],
    v.order.customerName,
    v.order.address.district,
    v.order.address.distanceKm,
    v.courier?.name ?? '',
    PAYMENT_METHOD_LABEL[v.order.payment.method],
    v.order.productsTotal,
    v.order.freightFee,
    v.economics.operationalCost,
    v.economics.result,
    v.economics.frozen ? 'registrado' : 'estimativa atual',
    v.deliveredAt ? formatDateTime(v.deliveredAt) : '',
  ])
  downloadCsv(
    `pedidos_${fileSuffix()}.csv`,
    toCsv(
      ['Pedido', 'Criado em', 'Status', 'Origem', 'Cliente', 'Bairro', 'Distância ida (km)', 'Motoboy', 'Pagamento', 'Produtos (R$)', 'Frete (R$)', 'Custo entrega (R$)', 'Resultado frete (R$)', 'Base do custo', 'Entregue em'],
      rows,
    ),
  )
  toast.success('Exportação concluída', `${rows.length} pedido(s) exportado(s).`)
}

function exportCouriers() {
  downloadCsv(
    `motoboys_${fileSuffix()}.csv`,
    toCsv(
      ['Motoboy', 'Código', 'Tentativas', 'Entregues', 'Falhas', 'Tempo médio em rota (min)', 'Km estimados', 'Fretes (R$)', 'Remuneração (R$)', 'Custo total (R$)', 'Resultado (R$)'],
      courierRows.value.map((r) => [
        r.name, r.internalCode, r.attempts, r.delivered, r.failed,
        r.avgRouteMinutes === null ? null : Math.round(r.avgRouteMinutes), r.distanceKm, r.freightRevenue, r.courierPay, r.deliveryCost, r.result,
      ]),
    ),
  )
  toast.success('Exportação concluída', `${courierRows.value.length} motoboy(s) exportado(s).`)
}

function exportDays() {
  downloadCsv(
    `resumo_diario_${fileSuffix()}.csv`,
    toCsv(
      ['Data', 'Pedidos', 'Entregues', 'Cancelados', 'Fretes (R$)', 'Custo (R$)', 'Resultado (R$)'],
      days.value.map((d) => [toDateInputValue(d.date), d.orders, d.delivered, d.cancelled, d.freightRevenue, d.deliveryCost, d.result]),
    ),
  )
  toast.success('Exportação concluída')
}
</script>

<template>
  <div>
    <PageHeader title="Relatórios" :description="`Indicadores calculados a partir dos pedidos registrados · ${periodText}`">
      <template #actions>
        <AppButton :icon="Download" :disabled="!views.length" @click="exportOrders">Exportar pedidos (CSV)</AppButton>
      </template>
    </PageHeader>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <SegmentedControl v-model="preset" :options="presetOptions" label="Período do relatório" />
      <div v-if="preset === 'custom'" class="flex flex-wrap items-center gap-2 text-sm">
        <label class="flex items-center gap-2 text-slate-600">De <input v-model="customFrom" type="date" class="field-input w-auto" /></label>
        <label class="flex items-center gap-2 text-slate-600">até <input v-model="customTo" type="date" class="field-input w-auto" /></label>
      </div>
    </div>

    <div v-if="!views.length" class="card">
      <EmptyState title="Nenhum pedido no período" description="Escolha outro intervalo de datas ou cadastre pedidos para gerar indicadores." />
    </div>

    <template v-else>
      <section aria-label="Indicadores do período" class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Pedidos" :value="formatInteger(metrics.orders)" :hint="`${formatCurrency(metrics.productsRevenue)} em produtos entregues`" />
        <KpiCard label="Entregas concluídas" :value="formatInteger(metrics.delivered)" tone="success" :hint="`taxa de conclusão ${formatPercent(metrics.completionRate)}`" />
        <KpiCard label="Cancelados" :value="formatInteger(metrics.cancelled)" :tone="metrics.cancelled ? 'warning' : 'neutral'" :hint="`${metrics.failedOpen} falha(s) pendente(s)`" />
        <KpiCard label="Tempo médio de entrega" :value="formatDuration(metrics.avgDeliveryMinutes)" :hint="`em rota: ${formatDuration(metrics.avgRouteMinutes)}`" definition="Do registro do pedido até a confirmação da entrega." />
        <KpiCard label="Fretes cobrados" :value="formatCurrency(metrics.freightRevenue)" definition="Soma do frete dos pedidos entregues. Valor dos produtos não incluído." hint="pedidos entregues" />
        <KpiCard label="Custo estimado das entregas" :value="formatCurrency(metrics.deliveryCost)" :hint="`remuneração ${formatCurrency(metrics.courierPay)}`" definition="Inclui todas as tentativas encerradas, inclusive as que falharam." />
        <KpiCard
          label="Resultado estimado dos fretes"
          :value="formatCurrency(metrics.freightResult)"
          :tone="metrics.freightResult < 0 ? 'danger' : 'success'"
          :hint="metrics.marginPct === null ? '—' : `margem ${formatPercent(metrics.marginPct, 1)}`"
        />
        <KpiCard
          label="Entregas com resultado negativo"
          :value="formatInteger(metrics.negativeResultDeliveries)"
          :tone="metrics.negativeResultDeliveries ? 'warning' : 'neutral'"
          :hint="`${metrics.unknownDistanceOrders} pedido(s) sem distância`"
          :to="{ name: 'calculator' }"
          definition="Pedidos entregues cujo custo estimado superou o frete cobrado."
        />
      </section>

      <section class="card mt-5" aria-labelledby="r-days">
        <div class="card-header">
          <h2 id="r-days" class="card-title">Fretes cobrados × custo estimado por dia</h2>
          <AppButton size="sm" variant="ghost" :icon="Download" @click="exportDays">CSV</AppButton>
        </div>
        <div class="p-4">
          <BarChart
            :labels="days.map((d) => formatShortDate(d.date))"
            :series="[
              { label: 'Fretes cobrados', data: days.map((d) => d.freightRevenue), color: CHART_COLORS.revenue },
              { label: 'Custo estimado', data: days.map((d) => d.deliveryCost), color: CHART_COLORS.cost },
            ]"
            :format="(v) => formatCurrency(v)"
            :height="260"
            :summary="`Fretes e custos por dia entre ${periodText}. Total de fretes ${formatCurrency(metrics.freightRevenue)} e custo ${formatCurrency(metrics.deliveryCost)}.`"
          />
        </div>
        <details class="border-t border-slate-100">
          <summary class="cursor-pointer px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900">Ver dados em tabela</summary>
          <div class="overflow-x-auto">
            <table class="table-base tabular">
              <thead>
                <tr><th scope="col">Data</th><th scope="col" class="text-right">Pedidos</th><th scope="col" class="text-right">Entregues</th><th scope="col" class="text-right">Cancelados</th><th scope="col" class="text-right">Fretes</th><th scope="col" class="text-right">Custo</th><th scope="col" class="text-right">Resultado</th></tr>
              </thead>
              <tbody>
                <tr v-for="d in days" :key="d.date.toISOString()">
                  <td>{{ formatShortDate(d.date) }}</td>
                  <td class="text-right">{{ d.orders }}</td>
                  <td class="text-right">{{ d.delivered }}</td>
                  <td class="text-right">{{ d.cancelled }}</td>
                  <td class="text-right">{{ formatCurrency(d.freightRevenue) }}</td>
                  <td class="text-right">{{ formatCurrency(d.deliveryCost) }}</td>
                  <td class="text-right" :class="d.result < 0 ? 'text-rose-700' : ''">{{ formatCurrency(d.result) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section class="card overflow-hidden" aria-labelledby="r-couriers">
          <div class="card-header">
            <h2 id="r-couriers" class="card-title">Desempenho por motoboy</h2>
            <AppButton size="sm" variant="ghost" :icon="Download" :disabled="!courierRows.length" @click="exportCouriers">CSV</AppButton>
          </div>
          <div v-if="courierRows.length" class="overflow-x-auto">
            <table class="table-base tabular">
              <thead>
                <tr>
                  <th scope="col">Motoboy</th>
                  <th scope="col" class="text-right">Entregues</th>
                  <th scope="col" class="text-right">Falhas</th>
                  <th scope="col" class="text-right">Tempo em rota</th>
                  <th scope="col" class="text-right">Km est.</th>
                  <th scope="col" class="text-right">Fretes</th>
                  <th scope="col" class="text-right">Remuneração</th>
                  <th scope="col" class="text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in courierRows" :key="r.courierId">
                  <td>
                    <RouterLink :to="{ name: 'courier-detail', params: { id: r.courierId } }" class="font-medium text-slate-900 hover:text-brand-700">{{ r.name }}</RouterLink>
                    <p class="text-xs text-slate-500">{{ r.internalCode }}</p>
                  </td>
                  <td class="text-right">{{ r.delivered }}</td>
                  <td class="text-right" :class="r.failed ? 'text-rose-700' : ''">{{ r.failed }}</td>
                  <td class="text-right">{{ formatDuration(r.avgRouteMinutes) }}</td>
                  <td class="text-right">{{ formatKm(r.distanceKm) }}</td>
                  <td class="text-right">{{ formatCurrency(r.freightRevenue) }}</td>
                  <td class="text-right">{{ formatCurrency(r.courierPay) }}</td>
                  <td class="text-right font-medium" :class="r.result < 0 ? 'text-rose-700' : 'text-emerald-700'">{{ formatCurrency(r.result) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <EmptyState v-else compact title="Nenhuma entrega encerrada no período" />
        </section>

        <section class="card" aria-labelledby="r-sources">
          <div class="card-header"><h2 id="r-sources" class="card-title">Pedidos por origem</h2></div>
          <ul class="space-y-3 p-4">
            <li v-for="s in sources" :key="s.source">
              <div class="flex items-baseline justify-between text-sm">
                <span class="text-slate-700">{{ ORDER_SOURCE_LABEL[s.source] }}</span>
                <span class="tabular text-slate-900">
                  <strong>{{ s.orders }}</strong>
                  <span class="ml-1 text-xs text-slate-400">{{ formatPercent((s.orders / metrics.orders) * 100) }}</span>
                </span>
              </div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full" :style="{ width: `${(s.orders / maxSource) * 100}%`, background: 'var(--primary)' }" />
              </div>
              <p class="tabular mt-0.5 text-xs text-slate-500">{{ s.delivered }} entregues · {{ formatCurrency(s.productsRevenue) }} em produtos · {{ formatCurrency(s.freightRevenue) }} em fretes</p>
            </li>
          </ul>
        </section>
      </div>

      <p class="mt-4 text-xs text-slate-500">
        Custos de entregas encerradas usam os parâmetros vigentes no momento do encerramento. Valores são estimativas operacionais.
        <template v-if="session.isDemo"> Os dados exibidos são demonstrativos.</template>
      </p>
    </template>
  </div>
</template>
