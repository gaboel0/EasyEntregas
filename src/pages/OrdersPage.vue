<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { FilterX, Plus, Search, SearchX } from 'lucide-vue-next'
import type { OrderSource, OrderStatus } from '@/types/domain'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import OrdersTable from '@/components/orders/OrdersTable.vue'
import { useOrdersStore } from '@/stores/orders'
import { useCouriersStore } from '@/stores/couriers'
import { useSessionStore } from '@/stores/session'
import { useNow } from '@/composables/useNow'
import { ACTIVE_STATUSES, ALL_ORDER_STATUSES, ORDER_STATUS_LABEL } from '@/modules/orders/orderWorkflow'
import { ORDER_SOURCE_LABEL, ORDER_SOURCES } from '@/modules/orders/orderLabels'
import { endOfDay, fromDateInputValue, isWithin, PERIOD_LABEL, rangeForPreset, startOfDay, type DateRange } from '@/utils/date'
import { formatCurrency, onlyDigits } from '@/utils/format'
import { normalizeText } from '@/utils/text'
import { sum } from '@/utils/number'

type StatusFilter = 'active' | 'all' | OrderStatus
type PeriodFilter = 'today' | 'yesterday' | 'last7' | 'last30' | 'all' | 'custom'
type SortKey = 'recent' | 'oldest' | 'waiting' | 'total'

const route = useRoute()
const router = useRouter()
const orders = useOrdersStore()
const couriers = useCouriersStore()
const session = useSessionStore()
const now = useNow()

/** Os filtros vivem na URL: links do dashboard abrem a lista já filtrada e o filtro sobrevive ao F5. */
function q(name: string): string | undefined {
  const v = route.query[name]
  return typeof v === 'string' && v ? v : undefined
}

const status = computed<StatusFilter>({
  get: () => (q('status') as StatusFilter) ?? 'active',
  set: (v) => setQuery({ status: v === 'active' ? undefined : v }),
})
const period = computed<PeriodFilter>({
  get: () => (q('period') as PeriodFilter) ?? 'all',
  set: (v) => setQuery({ period: v === 'all' ? undefined : v }),
})
const source = computed<OrderSource | ''>({ get: () => (q('source') as OrderSource) ?? '', set: (v) => setQuery({ source: v || undefined }) })
const courier = computed<string>({ get: () => q('courier') ?? '', set: (v) => setQuery({ courier: v || undefined }) })
const from = computed<string>({ get: () => q('from') ?? '', set: (v) => setQuery({ from: v || undefined }) })
const to = computed<string>({ get: () => q('to') ?? '', set: (v) => setQuery({ to: v || undefined }) })
const sort = computed<SortKey>({ get: () => (q('sort') as SortKey) ?? 'recent', set: (v) => setQuery({ sort: v === 'recent' ? undefined : v }) })

const search = ref(q('q') ?? '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setQuery({ q: value.trim() || undefined }), 200)
})

function setQuery(patch: LocationQueryRaw) {
  router.replace({ query: { ...route.query, ...patch } })
  limit.value = PAGE
}

function clearFilters() {
  search.value = ''
  router.replace({ query: {} })
}

const hasFilters = computed(() => Object.keys(route.query).length > 0)

const range = computed<DateRange | null>(() => {
  if (period.value === 'all') return null
  if (period.value === 'custom') {
    const f = fromDateInputValue(from.value)
    const t = fromDateInputValue(to.value)
    if (!f && !t) return null
    return { from: startOfDay(f ?? new Date(2000, 0, 1)), to: endOfDay(t ?? now.value) }
  }
  return rangeForPreset(period.value, now.value)
})

/** Pedidos após filtros de período/origem/motoboy/busca (antes do filtro de status, para as contagens). */
const base = computed(() => {
  const term = normalizeText(q('q') ?? '').replace(/^#/, '')
  const digits = onlyDigits(term)
  return orders.views.filter((v) => {
    if (range.value && !isWithin(v.order.createdAt, range.value)) return false
    if (source.value && v.order.source !== source.value) return false
    if (courier.value === 'none' ? !!v.delivery?.courierId : courier.value && !v.deliveries.some((d) => d.courierId === courier.value)) return false
    if (term) {
      const o = v.order
      const hit =
        String(o.number).startsWith(term) ||
        normalizeText(o.customerName).includes(term) ||
        normalizeText(`${o.address.street} ${o.address.number} ${o.address.district}`).includes(term) ||
        (digits.length >= 4 && onlyDigits(o.customerPhone).includes(digits))
      if (!hit) return false
    }
    return true
  })
})

const filtered = computed(() => {
  const list = base.value.filter((v) =>
    status.value === 'all' ? true : status.value === 'active' ? ACTIVE_STATUSES.includes(v.order.status) : v.order.status === status.value,
  )
  const sorted = [...list]
  if (sort.value === 'oldest') sorted.sort((a, b) => a.order.createdAt.localeCompare(b.order.createdAt))
  else if (sort.value === 'waiting') sorted.sort((a, b) => (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1))
  else if (sort.value === 'total') sorted.sort((a, b) => b.total - a.total)
  return sorted
})

const statusOptions = computed(() => [
  { value: 'active' as StatusFilter, label: 'Em andamento', count: base.value.filter((v) => ACTIVE_STATUSES.includes(v.order.status)).length },
  ...ALL_ORDER_STATUSES.map((s) => ({ value: s as StatusFilter, label: ORDER_STATUS_LABEL[s], count: base.value.filter((v) => v.order.status === s).length })),
  { value: 'all' as StatusFilter, label: 'Todos', count: base.value.length },
])

const PAGE = 50
const limit = ref(PAGE)
const visible = computed(() => filtered.value.slice(0, limit.value))

const totals = computed(() => ({
  products: sum(filtered.value.map((v) => v.order.productsTotal)),
  freight: sum(filtered.value.map((v) => v.order.freightFee)),
}))
</script>

<template>
  <div>
    <PageHeader title="Pedidos" description="Cadastre, acompanhe e atualize os pedidos de delivery do estabelecimento.">
      <template #actions>
        <AppButton v-if="session.can('orders.create')" variant="primary" :icon="Plus" :to="{ name: 'order-new' }">Novo pedido</AppButton>
      </template>
    </PageHeader>

    <div class="card">
      <div class="space-y-3 border-b border-slate-100 p-3">
        <SegmentedControl v-model="status" :options="statusOptions" label="Filtrar por status" size="sm" class="w-full" />
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(9rem,auto))]">
          <div class="relative">
            <Search :size="15" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input v-model="search" type="search" class="field-input pl-9" placeholder="Nº, cliente, telefone ou endereço" aria-label="Buscar pedidos" />
          </div>
          <select v-model="period" class="field-input" aria-label="Período">
            <option value="all">Qualquer data</option>
            <option v-for="p in ['today', 'yesterday', 'last7', 'last30', 'custom'] as const" :key="p" :value="p">{{ PERIOD_LABEL[p] }}</option>
          </select>
          <select v-model="source" class="field-input" aria-label="Origem">
            <option value="">Todas as origens</option>
            <option v-for="s in ORDER_SOURCES" :key="s" :value="s">{{ ORDER_SOURCE_LABEL[s] }}</option>
          </select>
          <select v-model="courier" class="field-input" aria-label="Motoboy">
            <option value="">Todos os motoboys</option>
            <option value="none">Sem motoboy</option>
            <option v-for="c in couriers.couriers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <select v-model="sort" class="field-input" aria-label="Ordenação">
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="waiting">Maior espera</option>
            <option value="total">Maior valor</option>
          </select>
        </div>
        <div v-if="period === 'custom'" class="flex flex-wrap items-center gap-2 text-sm">
          <label class="flex items-center gap-2 text-slate-600">De <input v-model="from" type="date" class="field-input w-auto" /></label>
          <label class="flex items-center gap-2 text-slate-600">até <input v-model="to" type="date" class="field-input w-auto" /></label>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p class="tabular">
            <strong class="text-slate-700">{{ filtered.length }}</strong> pedido(s) · produtos {{ formatCurrency(totals.products) }} · fretes
            {{ formatCurrency(totals.freight) }}
          </p>
          <button v-if="hasFilters" type="button" class="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700" @click="clearFilters">
            <FilterX :size="13" aria-hidden="true" /> Limpar filtros
          </button>
        </div>
      </div>

      <OrdersTable v-if="visible.length" :views="visible" />
      <EmptyState v-else :icon="SearchX" title="Nenhum pedido encontrado" description="Ajuste os filtros ou cadastre um novo pedido.">
        <AppButton v-if="hasFilters" @click="clearFilters">Limpar filtros</AppButton>
        <AppButton v-if="session.can('orders.create')" variant="primary" :to="{ name: 'order-new' }">Novo pedido</AppButton>
      </EmptyState>

      <div v-if="filtered.length > visible.length" class="border-t border-slate-100 p-3 text-center">
        <AppButton @click="limit += PAGE">Mostrar mais {{ Math.min(PAGE, filtered.length - visible.length) }} de {{ filtered.length - visible.length }} restantes</AppButton>
      </div>
    </div>
  </div>
</template>
