<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Clock, MapPinOff, UserPlus } from 'lucide-vue-next'
import type { OrderView } from '@/modules/orders/orderViews'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useOrderActions } from '@/composables/useOrderActions'
import { useNow } from '@/composables/useNow'
import { formatCurrency, formatDuration, formatKm, formatOrderNumber, formatTime, minutesBetween } from '@/utils/format'

const props = defineProps<{ view: OrderView; mode: 'queue' | 'assigned' | 'transit' }>()
const emit = defineEmits<{ assign: [view: OrderView] }>()

const actions = useOrderActions()
const now = useNow()

const primary = computed(() => actions.primaryAction(props.view))
const failAction = computed(() => actions.actionsFor(props.view).find((a) => a.to === 'delivery_failed'))
const routeMinutes = computed(() => (props.view.delivery?.dispatchedAt ? minutesBetween(props.view.delivery.dispatchedAt, now.value) : null))
</script>

<template>
  <article
    class="rounded-xl p-3 transition-colors"
    :class="view.isDispatchLate ? 'bg-amber-50' : 'bg-surface'"
    :aria-label="`Pedido ${formatOrderNumber(view.order.number)}`"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <RouterLink :to="{ name: 'order-detail', params: { id: view.order.id } }" class="text-sm font-semibold text-slate-900 hover:text-brand-700">
          {{ formatOrderNumber(view.order.number) }} · {{ view.order.customerName }}
        </RouterLink>
        <p class="truncate text-xs text-slate-500">
          {{ view.order.address.street }}, {{ view.order.address.number }} — {{ view.order.address.district }}
        </p>
      </div>
      <StatusBadge :status="view.order.status" />
    </div>

    <div class="tabular mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      <span v-if="view.order.address.distanceKm !== null">{{ formatKm(view.order.address.distanceKm) }} (ida)</span>
      <span v-else class="inline-flex items-center gap-1 text-amber-700"><MapPinOff :size="12" aria-hidden="true" /> sem distância</span>
      <span>frete {{ formatCurrency(view.order.freightFee) }}</span>
      <span :class="view.economics.result < 0 ? 'text-rose-700' : 'text-slate-600'" title="Resultado estimado: frete − custo operacional">
        resultado {{ formatCurrency(view.economics.result) }}
      </span>
      <span v-if="mode === 'transit' && view.delivery?.dispatchedAt">saiu às {{ formatTime(view.delivery.dispatchedAt) }} · há {{ formatDuration(routeMinutes) }}</span>
      <span v-else-if="view.waitingMinutes !== null" class="inline-flex items-center gap-1" :class="view.isDispatchLate ? 'font-semibold text-amber-800' : ''">
        <Clock :size="12" aria-hidden="true" /> pronto há {{ formatDuration(view.waitingMinutes) }}
      </span>
      <span v-else>recebido às {{ formatTime(view.order.createdAt) }}</span>
    </div>

    <p v-if="mode !== 'queue' && view.courier" class="mt-1.5 text-xs text-slate-700">
      Motoboy: <strong class="font-medium">{{ view.courier.name }}</strong>
    </p>

    <div class="mt-2.5 flex flex-wrap gap-1.5">
      <AppButton v-if="mode !== 'transit' && actions.canAssign(view)" size="sm" :variant="mode === 'queue' ? 'primary' : 'ghost'" :icon="UserPlus" @click="emit('assign', view)">
        {{ mode === 'queue' ? 'Atribuir motoboy' : 'Trocar' }}
      </AppButton>
      <AppButton
        v-if="primary && (mode !== 'queue' || primary.to !== 'out_for_delivery')"
        size="sm"
        :variant="mode === 'queue' ? 'secondary' : 'primary'"
        :disabled="!!primary.blockedReason"
        :title="primary.blockedReason"
        :loading="actions.isPending(view.order.id)"
        @click="actions.changeStatus(view, primary.to)"
      >
        {{ primary.label }}
      </AppButton>
      <AppButton
        v-if="mode === 'transit' && failAction"
        size="sm"
        variant="ghost"
        class="text-rose-600 hover:bg-rose-50"
        @click="actions.changeStatus(view, 'delivery_failed')"
      >
        Registrar falha
      </AppButton>
    </div>
  </article>
</template>
