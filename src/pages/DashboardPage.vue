<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import IncomingOrders from '@/components/dashboard/IncomingOrders.vue'
import CouriersPanel from '@/components/dashboard/CouriersPanel.vue'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { useNow } from '@/composables/useNow'

/** Home: só o que se acompanha o dia todo, os pedidos e os motoboys. Números e gráficos ficam em Análise. */
const session = useSessionStore()
const now = useNow()
const orders = useOrdersStore()

interface Pulse {
  label: string
  count: number
  to: RouteLocationRaw
  alert?: boolean
}

/** O retrato da operação agora: o que chegou, o que está em andamento e o que precisa de ação. */
const pulse = computed<Pulse[]>(() => {
  const v = orders.views
  const count = (...s: string[]) => v.filter((x) => s.includes(x.order.status)).length
  const attention = v.filter((x) => x.isDispatchLate || x.order.status === 'delivery_failed').length
  return [
    { label: 'Novos', count: count('received'), to: { name: 'orders', query: { status: 'received' } } },
    { label: 'Em preparação', count: count('preparing'), to: { name: 'orders', query: { status: 'preparing' } } },
    { label: 'Prontos para sair', count: count('ready_for_pickup', 'awaiting_courier'), to: { name: 'dispatch' } },
    { label: 'Em rota', count: count('out_for_delivery'), to: { name: 'orders', query: { status: 'out_for_delivery' } } },
    { label: 'Precisam de atenção', count: attention, to: { name: 'dispatch' }, alert: attention > 0 },
  ]
})

const greeting = computed(() => {
  const h = now.value.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
})
const todayLabel = computed(() => now.value.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
</script>

<template>
  <div>
    <PageHeader :title="`${greeting}, ${session.user?.name.split(' ')[0]}`" :description="todayLabel" />
    <dl class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Resumo da operação agora">
      <RouterLink v-for="p in pulse" :key="p.label" :to="p.to" class="card px-4 py-3.5 transition-colors duration-(--duration-fast) hover:bg-slate-100/70">
        <dd class="tabular text-3xl font-bold tracking-tight" :class="p.alert ? 'text-amber-700' : 'text-slate-900'">{{ p.count }}</dd>
        <dt class="text-sm text-slate-500">{{ p.label }}</dt>
      </RouterLink>
    </dl>
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <IncomingOrders />
      <CouriersPanel />
    </div>
  </div>
</template>
