<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  Bike,
  Calculator,
  ChartColumn,
  QrCode,
  ClipboardList,
  LayoutDashboard,
  Map,
  Route as RouteIcon,
  Settings,
  X,
} from 'lucide-vue-next'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { useSidebar } from '@/composables/useSidebar'
import { ACTIVE_STATUSES, PRE_DISPATCH_STATUSES } from '@/modules/orders/orderWorkflow'

const { collapsed, drawerOpen, isDesktop, closeDrawer } = useSidebar()

const route = useRoute()
const orders = useOrdersStore()
const session = useSessionStore()

const activeCount = computed(() => orders.views.filter((v) => ACTIVE_STATUSES.includes(v.order.status)).length)
const toDispatch = computed(() => orders.views.filter((v) => PRE_DISPATCH_STATUSES.includes(v.order.status) && !v.delivery?.courierId))
const lateCount = computed(() => orders.views.filter((v) => v.isDispatchLate).length)

const sections = computed(() => [
  {
    label: 'Operação',
    items: [
      { name: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
      { name: 'orders', label: 'Pedidos', icon: ClipboardList, badge: activeCount.value || undefined },
      { name: 'dispatch', label: 'Despacho', icon: RouteIcon, badge: toDispatch.value.length || undefined, alert: lateCount.value > 0 },
      { name: 'map', label: 'Mapa de entregas', icon: Map },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { name: 'couriers', label: 'Motoboys', icon: Bike },
      { name: 'calculator', label: 'Calculadora de frete', icon: Calculator },
      { name: 'app-qrcode', label: 'QRCode para app', icon: QrCode },
      ...(session.can('reports.view') ? [{ name: 'reports', label: 'Relatórios', icon: ChartColumn }] : []),
      { name: 'settings', label: 'Configurações', icon: Settings },
    ],
  },
])

function isActive(name: string) {
  return route.matched.some((r) => r.name === name || r.meta.section === name)
}

// Marcador do item ativo: um único elemento, posicionado por transform, que desliza entre itens.
const nav = ref<HTMLElement | null>(null)
const markerY = ref<number | null>(null)
const markerReady = ref(false)

function placeMarker() {
  const active = sections.value.flatMap((s) => s.items).find((i) => isActive(i.name))
  const icon = active ? nav.value?.querySelector<HTMLElement>(`[data-icon="${active.name}"]`) : null
  markerY.value = icon ? icon.offsetTop : null
}

watch(
  () => route.fullPath,
  () => nextTick(placeMarker),
)
watch(sections, () => nextTick(placeMarker))
onMounted(() => {
  placeMarker()
  // Só habilita a animação depois da primeira posição, para o marcador não "voar" na carga.
  requestAnimationFrame(() => requestAnimationFrame(() => (markerReady.value = true)))
})
</script>

<template>
  <div class="app-backdrop" :data-open="drawerOpen" aria-hidden="true" @click="closeDrawer" />
  <aside
    id="sidebar"
    class="app-sidebar"
    :data-open="drawerOpen"
    :data-collapsed="collapsed"
    aria-label="Navegação principal"
    :inert="!isDesktop && !drawerOpen ? true : undefined"
  >
    <div class="flex h-16 shrink-0 items-center justify-between px-5">
      <RouterLink to="/" class="sb-logo flex min-w-0 items-center gap-2.5 overflow-hidden" aria-label="EasyEntregas — início" @click="closeDrawer">
        <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-solid text-[#0f172a]" aria-hidden="true">
          <Bike :size="18" />
        </span>
        <span class="sb-label text-[15px] font-semibold tracking-tight whitespace-nowrap text-sidebar-fg">EasyEntregas</span>
      </RouterLink>
      <button type="button" class="rounded-md p-1 text-sidebar-muted hover:text-sidebar-fg md:hidden" aria-label="Fechar menu" @click="closeDrawer">
        <X :size="18" />
      </button>
    </div>

    <nav ref="nav" class="relative flex-1 overflow-x-hidden overflow-y-auto px-3 pt-1 pb-2">
      <span
        class="sb-marker"
        :class="{ 'sb-marker--ready': markerReady }"
        :style="{ transform: `translateY(${markerY ?? 0}px)`, opacity: markerY === null ? 0 : 1 }"
        aria-hidden="true"
      />
      <div v-for="section in sections" :key="section.label" class="mb-4">
        <div class="relative mb-1.5 h-5 px-2.5">
          <p class="sb-label text-[11px] leading-5 font-medium tracking-wider whitespace-nowrap text-sidebar-muted/80 uppercase">{{ section.label }}</p>
          <span class="sb-rule" aria-hidden="true" />
        </div>
        <ul class="space-y-1">
          <li v-for="item in section.items" :key="item.name">
            <RouterLink
              :to="{ name: item.name }"
              class="group flex items-center gap-3 overflow-hidden rounded-xl px-2 py-1 text-sm transition-colors"
              :class="isActive(item.name) ? 'font-bold text-sidebar-fg' : 'font-medium text-sidebar-muted hover:text-sidebar-fg'"
              :aria-current="isActive(item.name) ? 'page' : undefined"
              :title="collapsed ? item.label : undefined"
              @click="closeDrawer"
            >
              <span
                :data-icon="item.name"
                class="relative z-10 grid size-9 shrink-0 place-items-center rounded-xl transition-colors"
                :class="isActive(item.name) ? 'text-[#0f172a]' : 'group-hover:bg-sidebar-hover'"
                aria-hidden="true"
              >
                <component :is="item.icon" :size="18" />
              </span>
              <span class="sb-label min-w-0 flex-1 truncate" :title="item.label">{{ item.label }}</span>
              <span
                v-if="'badge' in item && item.badge"
                class="sb-label tabular rounded-full px-1.5 py-px text-[11px] font-semibold"
                :class="'alert' in item && item.alert ? 'bg-[#fbbf24] text-[#451a03]' : 'bg-sidebar-active text-sidebar-fg'"
                :title="'alert' in item && item.alert ? 'Há pedidos aguardando despacho além do tempo limite' : undefined"
              >
                {{ item.badge }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="sb-label mx-3 mb-3 shrink-0 border-t border-slate-200 px-2 pt-3 text-xs whitespace-nowrap text-sidebar-muted">
      <p class="truncate font-medium text-sidebar-fg">{{ session.establishment?.name }}</p>
      <p class="mt-0.5 truncate">Painel do estabelecimento · v0.1</p>
    </div>
  </aside>
</template>
