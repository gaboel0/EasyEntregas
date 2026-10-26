<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  Bike,
  Calculator,
  ChartColumn,
  ClipboardList,
  LayoutDashboard,
  Map,
  Route as RouteIcon,
  Settings,
  X,
} from 'lucide-vue-next'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { ACTIVE_STATUSES, PRE_DISPATCH_STATUSES } from '@/modules/orders/orderWorkflow'

defineProps<{ mobileOpen: boolean }>()
const emit = defineEmits<{ close: [] }>()

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
      ...(session.can('reports.view') ? [{ name: 'reports', label: 'Relatórios', icon: ChartColumn }] : []),
      { name: 'settings', label: 'Configurações', icon: Settings },
    ],
  },
])

function isActive(name: string) {
  return route.matched.some((r) => r.name === name || r.meta.section === name)
}
</script>

<template>
  <div v-if="mobileOpen" class="fixed inset-0 z-40 animate-fade-in bg-black/40 lg:hidden" aria-hidden="true" @click="emit('close')" />
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-muted transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
    aria-label="Navegação principal"
  >
    <div class="flex h-14 items-center justify-between px-4">
      <RouterLink to="/" class="flex items-center gap-2 text-white" @click="emit('close')">
        <span class="grid size-8 place-items-center rounded-lg bg-primary text-white" aria-hidden="true">
          <Bike :size="18" />
        </span>
        <span class="text-[15px] font-semibold tracking-tight text-sidebar-fg">RotaCerta</span>
      </RouterLink>
      <button type="button" class="rounded-md p-1 text-sidebar-muted hover:text-sidebar-fg lg:hidden" aria-label="Fechar menu" @click="emit('close')">
        <X :size="18" />
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-2">
      <div v-for="section in sections" :key="section.label" class="mb-5">
        <p class="mb-1.5 px-2 text-[11px] font-medium tracking-wider text-sidebar-muted uppercase">{{ section.label }}</p>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.name">
            <RouterLink
              :to="{ name: item.name }"
              class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
              :class="isActive(item.name) ? 'bg-sidebar-active text-sidebar-fg' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg'"
              :aria-current="isActive(item.name) ? 'page' : undefined"
              @click="emit('close')"
            >
              <component :is="item.icon" :size="17" aria-hidden="true" />
              <span class="flex-1">{{ item.label }}</span>
              <span
                v-if="'badge' in item && item.badge"
                class="tabular rounded-full px-1.5 py-px text-[11px] font-semibold"
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

    <div class="border-t border-white/10 px-4 py-3 text-xs text-sidebar-muted">
      <p class="truncate font-medium text-sidebar-fg">{{ session.establishment?.name }}</p>
      <p class="mt-0.5">Painel do estabelecimento · v0.1</p>
    </div>
  </aside>
</template>
