<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Camera, Globe, Inbox, MapPinOff, MessageCircle, Phone, Plus, Radio, Sparkles, Store, TriangleAlert } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { OrderSource } from '@/types/domain'
import type { OrderView } from '@/modules/orders/orderViews'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import OrderStatusModal from '@/components/dashboard/OrderStatusModal.vue'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { useAppStore } from '@/stores/app'
import { useNow } from '@/composables/useNow'
import { useDemoIncoming } from '@/composables/useDemoIncoming'
import { ORDER_SOURCE_LABEL } from '@/modules/orders/orderLabels'
import { ACTIVE_STATUSES } from '@/modules/orders/orderWorkflow'
import { INTEGRATIONS } from '@/services/integrations'
import { formatCurrency, formatDuration, formatOrderNumber, formatRelative, formatTime, minutesBetween } from '@/utils/format'

const LIMIT = 12
/** Pedido "novo": acabou de entrar e ainda não começou a ser preparado. */
const NEW_WINDOW_MIN = 10
/** Atualização automática com backend: busca novos pedidos a cada 15 s. */
const POLL_MS = 15_000

const orders = useOrdersStore()
const session = useSessionStore()
const app = useAppStore()
const now = useNow()
const demo = useDemoIncoming()

const SOURCE_ICON: Record<OrderSource, Component> = { whatsapp: MessageCircle, instagram: Camera, phone: Phone, counter: Store, other: Globe }

const isNew = (v: OrderView) => v.order.status === 'received' && minutesBetween(v.order.createdAt, now.value) <= NEW_WINDOW_MIN
const needsAttention = (v: OrderView) =>
  v.isDispatchLate || v.order.status === 'delivery_failed' || (v.order.status === 'received' && !isNew(v)) || (v.order.status === 'awaiting_courier' && !v.delivery?.courierId)

const active = computed(() => orders.views.filter((v) => ACTIVE_STATUSES.includes(v.order.status)))
const newCount = computed(() => active.value.filter(isNew).length)
const attentionCount = computed(() => active.value.filter((v) => needsAttention(v) && !isNew(v)).length)

/** Novos primeiro, depois os que pedem atenção, depois os mais recentes. */
const finished = computed(() =>
  orders.views
    .filter((v) => !ACTIVE_STATUSES.includes(v.order.status) && new Date(v.order.createdAt).toDateString() === now.value.toDateString())
    .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt)),
)
const list = computed(() =>
  [
    ...[...active.value].sort(
      (a, b) =>
        Number(isNew(b)) - Number(isNew(a)) ||
        Number(needsAttention(b)) - Number(needsAttention(a)) ||
        b.order.createdAt.localeCompare(a.order.createdAt),
    ),
    ...finished.value,
  ].slice(0, LIMIT),
)

const selectedId = ref<string | null>(null)
const channels = INTEGRATIONS.filter((i) => ['whatsapp', 'instagram'].includes(i.key))

// Com backend real, consulta periodicamente os pedidos que chegaram pelas integrações.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (!session.isDemo) timer = setInterval(() => void app.refresh(), POLL_MS)
})
onBeforeUnmount(() => clearInterval(timer))

function deliveryLabel(v: OrderView): { text: string; tone: string } {
  if (v.order.fulfillment === 'pickup') {
    if (v.order.status === 'ready_for_pickup') return { text: `Cliente vem retirar · pronto há ${formatDuration(v.waitingMinutes)}`, tone: 'text-teal-700' }
    return { text: 'Retirada no balcão', tone: 'text-slate-500' }
  }
  if (v.order.status === 'out_for_delivery') {
    const since = v.delivery?.dispatchedAt ? ` · há ${formatDuration(minutesBetween(v.delivery.dispatchedAt, now.value))}` : ''
    return { text: `Em rota com ${v.courier?.name.split(' ')[0] ?? 'motoboy'}${since}`, tone: 'text-sky-700' }
  }
  if (v.order.status === 'delivery_failed') return { text: 'Falha — decidir nova tentativa', tone: 'text-rose-700 font-medium' }
  if (v.courier) return { text: `Motoboy: ${v.courier.name.split(' ')[0]}`, tone: 'text-slate-700' }
  if (v.isDispatchLate) return { text: `Sem motoboy · pronto há ${formatDuration(v.waitingMinutes)}`, tone: 'text-amber-800 font-medium' }
  return { text: 'Sem motoboy', tone: 'text-slate-500' }
}
</script>

<template>
  <section class="card overflow-hidden" aria-labelledby="incoming-title">
    <div class="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 id="incoming-title" class="text-lg font-semibold tracking-tight text-slate-900">Pedidos recebidos</h2>
          <span v-if="newCount" class="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
            <Sparkles :size="12" aria-hidden="true" /> {{ newCount }} {{ newCount === 1 ? 'novo' : 'novos' }}
          </span>
          <span v-if="attentionCount" class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300 ring-inset">
            <TriangleAlert :size="12" aria-hidden="true" /> {{ attentionCount }} {{ attentionCount === 1 ? 'precisa de atenção' : 'precisam de atenção' }}
          </span>
        </div>
        <p class="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Radio :size="12" :class="session.isDemo ? 'text-amber-600' : 'text-emerald-600'" aria-hidden="true" />
          <template v-if="session.isDemo">Dados de demonstração · atualizado às {{ formatTime(now.toISOString()) }}</template>
          <template v-else>Atualização automática a cada 15 s · última às {{ formatTime(now.toISOString()) }}</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AppButton v-if="session.isDemo && session.can('orders.create')" size="sm" variant="ghost" :icon="Sparkles" :loading="demo.busy.value" title="Gera um pedido fictício para demonstrar a chegada em tempo real" @click="demo.simulate()">
          Simular (demo)
        </AppButton>
        <AppButton v-if="session.can('orders.create')" size="sm" :icon="Plus" :to="{ name: 'order-new' }">Cadastrar manualmente</AppButton>
      </div>
    </div>

    <ul v-if="list.length" class="px-2 pb-2">
      <li v-for="v in list" :key="v.order.id" class="relative">
        <button
          type="button"
          class="relative grid w-full gap-x-4 gap-y-2 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-slate-100/60 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_auto] md:items-center"
          :class="[isNew(v) ? 'bg-brand-50/50' : '', !ACTIVE_STATUSES.includes(v.order.status) ? 'opacity-70' : '']"
          :aria-label="`Abrir pedido ${formatOrderNumber(v.order.number)} de ${v.order.customerName}`"
          @click="selectedId = v.order.id"
        >
          <span v-if="isNew(v) || needsAttention(v)" class="absolute inset-y-3 left-0 w-0.5 rounded-full" :class="isNew(v) ? 'bg-primary' : 'bg-amber-500'" aria-hidden="true" />

          <span class="block min-w-0">
            <span class="flex flex-wrap items-center gap-2">
              <span class="truncate font-semibold text-slate-900">{{ formatOrderNumber(v.order.number) }} · {{ v.order.customerName }}</span>
              <span v-if="isNew(v)" class="animate-pulse rounded-full bg-primary px-2 py-px text-xs font-bold text-white">Novo</span>
            </span>
            <span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1"><component :is="SOURCE_ICON[v.order.source]" :size="12" aria-hidden="true" /> {{ ORDER_SOURCE_LABEL[v.order.source] }}</span>
              <span class="tabular">{{ formatTime(v.order.createdAt) }} · {{ formatRelative(v.order.createdAt, now) }}</span>
            </span>
          </span>

          <span class="block min-w-0 text-xs">
            <StatusBadge :status="v.order.status" :pickup="v.order.fulfillment === 'pickup'" />
            <span class="mt-1 flex items-center gap-1 truncate" :class="deliveryLabel(v).tone">
              <MapPinOff v-if="v.order.fulfillment !== 'pickup' && !v.order.address.location" :size="12" class="shrink-0 text-slate-400" aria-label="localização pendente" />
              {{ deliveryLabel(v).text }}
            </span>
          </span>

          <span class="tabular block text-sm font-semibold text-slate-900 md:text-right">{{ formatCurrency(v.total) }}</span>
        </button>
      </li>
    </ul>

    <EmptyState v-else :icon="Inbox" title="Nenhum pedido em andamento" description="Quando as integrações com WhatsApp e Instagram estiverem conectadas, os pedidos chegarão aqui automaticamente. Por enquanto, você pode cadastrar pedidos manualmente." />

    <div class="flex flex-wrap items-center justify-between gap-2 px-5 pt-1 pb-4 text-xs text-slate-500">
      <p>
        {{ channels.map((c) => c.name).join(' e ') }} ainda não conectados —
        <RouterLink :to="{ name: 'settings', query: { tab: 'integracoes' } }" class="font-medium text-brand-600 hover:text-brand-700">ver integrações</RouterLink>
      </p>
      <RouterLink v-if="active.length > LIMIT" :to="{ name: 'orders' }" class="font-medium text-brand-600 hover:text-brand-700">Ver todos os {{ active.length }} →</RouterLink>
    </div>

    <OrderStatusModal :order-id="selectedId" @close="selectedId = null" />
  </section>
</template>
