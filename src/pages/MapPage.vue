<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { Crosshair, MapPinOff, Satellite } from 'lucide-vue-next'
import type { OrderStatus } from '@/types/domain'
import type { OrderView } from '@/modules/orders/orderViews'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AssignCourierModal from '@/components/deliveries/AssignCourierModal.vue'
import { createBaseMap, circleIcon, storeIcon, escapeHtml, L } from '@/components/map/leafletSetup'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { useOrderActions } from '@/composables/useOrderActions'
import { ACTIVE_STATUSES } from '@/modules/orders/orderWorkflow'
import { formatCurrency, formatDuration, formatKm, formatOrderNumber, formatTime } from '@/utils/format'

type Category = 'preparing' | 'dispatch' | 'transit' | 'failed'

const CATEGORY: Record<Category, { label: string; color: string; statuses: OrderStatus[] }> = {
  preparing: { label: 'Em preparação', color: '#8b5cf6', statuses: ['received', 'preparing'] },
  dispatch: { label: 'Aguardando despacho', color: '#f59e0b', statuses: ['ready_for_pickup', 'awaiting_courier'] },
  transit: { label: 'Em rota', color: '#0ea5e9', statuses: ['out_for_delivery'] },
  failed: { label: 'Falha na entrega', color: '#f43f5e', statuses: ['delivery_failed'] },
}
const CATEGORIES = Object.keys(CATEGORY) as Category[]
const categoryOf = (s: OrderStatus): Category | null => CATEGORIES.find((c) => CATEGORY[c].statuses.includes(s)) ?? null

const route = useRoute()
const router = useRouter()
const orders = useOrdersStore()
const session = useSessionStore()
const actions = useOrderActions()

const visible = ref<Record<Category, boolean>>({ preparing: true, dispatch: true, transit: true, failed: true })
const selectedId = computed(() => (typeof route.query.order === 'string' ? route.query.order : null))
const selected = computed(() => (selectedId.value ? orders.viewById.get(selectedId.value) ?? null : null))
const assignTarget = ref<OrderView | null>(null)

const active = computed(() => orders.views.filter((v) => ACTIVE_STATUSES.includes(v.order.status) && v.order.fulfillment !== 'pickup'))
const located = computed(() => active.value.filter((v) => v.order.address.location && visible.value[categoryOf(v.order.status)!]))
const unlocated = computed(() => active.value.filter((v) => !v.order.address.location))
const counts = computed(() =>
  Object.fromEntries(CATEGORIES.map((c) => [c, active.value.filter((v) => v.order.address.location && categoryOf(v.order.status) === c).length])) as Record<Category, number>,
)

const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
const markers = new Map<string, L.Marker>()

function select(id: string | null) {
  router.replace({ query: { ...route.query, order: id ?? undefined } })
}

function popupHtml(v: OrderView) {
  return `<strong>${formatOrderNumber(v.order.number)} · ${escapeHtml(v.order.customerName)}</strong><br>${escapeHtml(v.order.address.street)}, ${escapeHtml(v.order.address.number)}<br><span style="color:#64748b">${escapeHtml(CATEGORY[categoryOf(v.order.status)!].label)}${v.courier ? ' · ' + escapeHtml(v.courier.name) : ''}</span>`
}

function syncMarkers() {
  if (!map) return
  const keep = new Set<string>()
  for (const v of located.value) {
    const loc = v.order.address.location!
    const cat = categoryOf(v.order.status)!
    const isSelected = v.order.id === selectedId.value
    const icon = circleIcon(CATEGORY[cat].color, String(v.order.number).slice(-3), isSelected ? 30 : 24, isSelected)
    keep.add(v.order.id)
    let marker = markers.get(v.order.id)
    if (!marker) {
      marker = L.marker([loc.lat, loc.lng], { icon, title: `Pedido ${formatOrderNumber(v.order.number)}`, keyboard: true, riseOnHover: true })
        .addTo(map)
        .on('click', () => select(v.order.id))
      markers.set(v.order.id, marker)
    } else {
      marker.setLatLng([loc.lat, loc.lng]).setIcon(icon)
    }
    marker.setZIndexOffset(isSelected ? 1000 : 0)
    marker.bindPopup(popupHtml(v))
  }
  for (const [id, marker] of markers) {
    if (!keep.has(id)) {
      marker.remove()
      markers.delete(id)
    }
  }
}

function focusSelected() {
  const v = selected.value
  if (!map || !v?.order.address.location) return
  const { lat, lng } = v.order.address.location
  map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  markers.get(v.order.id)?.openPopup()
}

function fitAll() {
  if (!map) return
  const points = located.value.map((v) => [v.order.address.location!.lat, v.order.address.location!.lng] as [number, number])
  const origin = session.establishment?.location
  if (origin) points.push([origin.lat, origin.lng])
  if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
}

onMounted(() => {
  if (!mapEl.value) return
  const origin = session.establishment?.location ?? { lat: -23.5505, lng: -46.6333 }
  map = createBaseMap(mapEl.value, origin, 14)
  if (session.establishment?.location) {
    L.marker([origin.lat, origin.lng], { icon: storeIcon(), title: session.establishment.name, zIndexOffset: 2000 })
      .addTo(map)
      .bindPopup(`<strong>${escapeHtml(session.establishment.name)}</strong><br>Estabelecimento`)
  }
  syncMarkers()
  if (selected.value?.order.address.location) focusSelected()
  else fitAll()
})

watch(located, syncMarkers)
watch(selectedId, () => {
  syncMarkers()
  focusSelected()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  markers.clear()
})

const listByCategory = computed(() =>
  CATEGORIES.map((c) => ({
    category: c,
    items: located.value.filter((v) => categoryOf(v.order.status) === c),
  })).filter((g) => g.items.length),
)
</script>

<template>
  <div>
    <PageHeader title="Mapa de entregas" description="Endereços dos pedidos em andamento. As posições são dos endereços de entrega, não dos motoboys.">
      <template #actions>
        <AppButton :icon="Crosshair" @click="fitAll">Enquadrar todos</AppButton>
      </template>
    </PageHeader>

    <div class="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside class="card flex max-h-[calc(100vh-11rem)] min-h-[20rem] flex-col overflow-hidden lg:order-first">
        <div v-if="selected" class="border-b border-slate-100 bg-slate-100/50 p-4">
          <div class="flex items-start justify-between gap-2">
            <RouterLink :to="{ name: 'order-detail', params: { id: selected.order.id } }" class="text-sm font-semibold text-slate-900 hover:text-brand-700">
              {{ formatOrderNumber(selected.order.number) }} · {{ selected.order.customerName }}
            </RouterLink>
            <button type="button" class="text-xs text-slate-500 hover:text-slate-800" @click="select(null)">Fechar</button>
          </div>
          <p class="mt-0.5 text-xs text-slate-600">{{ selected.order.address.street }}, {{ selected.order.address.number }} — {{ selected.order.address.district }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge :status="selected.order.status" />
            <span class="tabular text-xs text-slate-500">{{ formatKm(selected.order.address.distanceKm) }} · frete {{ formatCurrency(selected.order.freightFee) }}</span>
          </div>
          <p class="mt-1.5 text-xs text-slate-600">
            {{ selected.courier ? `Motoboy: ${selected.courier.name}` : 'Sem motoboy atribuído' }}
            <template v-if="selected.delivery?.dispatchedAt"> · saiu às {{ formatTime(selected.delivery.dispatchedAt) }}</template>
            <template v-else-if="selected.waitingMinutes !== null"> · pronto há {{ formatDuration(selected.waitingMinutes) }}</template>
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <AppButton v-if="actions.canAssign(selected) && !selected.courier" size="sm" variant="primary" @click="assignTarget = selected">Atribuir motoboy</AppButton>
            <AppButton size="sm" :to="{ name: 'order-detail', params: { id: selected.order.id } }">Ver pedido</AppButton>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div v-for="group in listByCategory" :key="group.category">
            <p class="sticky top-0 z-[1] flex items-center gap-2 border-b border-slate-100 bg-surface px-4 py-2 text-xs font-semibold text-slate-600">
              <span class="size-2.5 rounded-full" :style="{ background: CATEGORY[group.category].color }" aria-hidden="true" />
              {{ CATEGORY[group.category].label }} <span class="font-normal text-slate-400">{{ group.items.length }}</span>
            </p>
            <ul>
              <li v-for="v in group.items" :key="v.order.id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-100/70"
                  :class="{ 'bg-brand-50/70': v.order.id === selectedId }"
                  :aria-pressed="v.order.id === selectedId"
                  @click="select(v.order.id)"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-slate-800">{{ formatOrderNumber(v.order.number) }} · {{ v.order.customerName }}</span>
                    <span class="block truncate text-xs text-slate-500">{{ v.order.address.district }}{{ v.courier ? ` · ${v.courier.name.split(' ')[0]}` : '' }}</span>
                  </span>
                  <span v-if="v.isDispatchLate" class="shrink-0 rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800">atrasado</span>
                </button>
              </li>
            </ul>
          </div>
          <EmptyState v-if="!listByCategory.length" compact title="Nenhum pedido localizado" description="Pedidos em andamento com coordenadas aparecem aqui." />

          <div v-if="unlocated.length" class="border-t border-slate-100">
            <p class="flex items-center gap-2 bg-amber-50/70 px-4 py-2 text-xs font-semibold text-amber-900">
              <MapPinOff :size="13" aria-hidden="true" /> Localização pendente <span class="font-normal">{{ unlocated.length }}</span>
            </p>
            <ul>
              <li v-for="v in unlocated" :key="v.order.id" class="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span class="min-w-0">
                  <span class="block truncate text-slate-800">{{ formatOrderNumber(v.order.number) }} · {{ v.order.address.street }}, {{ v.order.address.number }}</span>
                  <span class="block text-xs text-slate-500">Endereço sem coordenadas — marque no mapa ao editar o pedido.</span>
                </span>
                <RouterLink v-if="session.can('orders.edit')" :to="{ name: 'order-edit', params: { id: v.order.id } }" class="shrink-0 text-xs font-medium text-brand-700 hover:underline">Localizar</RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <div class="card relative h-[calc(100vh-11rem)] min-h-[24rem] overflow-hidden">
        <div ref="mapEl" class="absolute inset-0" role="application" aria-label="Mapa dos pedidos em andamento" />
        <div class="absolute right-3 bottom-6 z-[400] rounded-xl bg-surface/95 p-3 text-xs shadow-md">
          <p class="mb-1.5 font-semibold text-slate-700">Legenda</p>
          <label v-for="c in CATEGORIES" :key="c" class="flex cursor-pointer items-center gap-2 py-0.5 text-slate-700">
            <input v-model="visible[c]" type="checkbox" class="accent-brand-600" />
            <span class="size-3 rounded-full border-2 border-surface shadow" :style="{ background: CATEGORY[c].color }" aria-hidden="true" />
            {{ CATEGORY[c].label }} <span class="tabular ml-auto pl-2 text-slate-400">{{ counts[c] }}</span>
          </label>
          <p class="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-1.5 text-slate-600">
            <span class="size-3 rounded bg-sidebar" aria-hidden="true" /> Estabelecimento
          </p>
        </div>
        <div class="absolute top-3 right-3 z-[400] flex max-w-xs items-start gap-2 rounded-lg bg-surface/95 p-2.5 text-xs text-slate-600 shadow-md">
          <Satellite :size="14" class="mt-0.5 shrink-0" aria-hidden="true" />
          Rastreamento dos motoboys em tempo real será exibido quando o aplicativo do entregador estiver conectado.
        </div>
      </div>
    </div>

    <AssignCourierModal :open="!!assignTarget" :view="assignTarget" @close="assignTarget = null" />
  </div>
</template>
