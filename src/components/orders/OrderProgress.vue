<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import type { OrderHistoryEntry, OrderStatus } from '@/types/domain'
import { flowFor, statusLabel } from '@/modules/orders/orderWorkflow'
import type { Fulfillment } from '@/types/domain'
import { formatTime } from '@/utils/format'

/** Etapas do fluxo principal com o horário em que cada uma foi atingida (última ocorrência). */
const props = defineProps<{ status: OrderStatus; history: OrderHistoryEntry[]; fulfillment?: Fulfillment }>()
const flow = computed(() => flowFor(props.fulfillment))

const reachedAt = computed(() => {
  const map = new Map<OrderStatus, string>()
  for (const h of props.history) if (h.kind === 'status_change') map.set(h.to, h.at)
  return map
})

const currentIndex = computed(() => {
  if (props.status === 'delivery_failed') return flow.value.indexOf('out_for_delivery')
  if (props.status === 'cancelled') {
    let last = -1
    flow.value.forEach((s, i) => reachedAt.value.has(s) && (last = i))
    return last
  }
  return flow.value.indexOf(props.status)
})

const halted = computed(() => props.status === 'cancelled' || props.status === 'delivery_failed')
</script>

<template>
  <ol class="grid grid-cols-3 gap-y-4" :class="flow.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-6'" aria-label="Etapas do pedido">
    <li v-for="(step, index) in flow" :key="step" class="relative flex flex-col items-center text-center">
      <span
        v-if="index > 0"
        class="absolute top-3.5 right-1/2 left-[-50%] h-0.5"
        :class="index <= currentIndex ? 'bg-brand-500' : 'bg-slate-200'"
        aria-hidden="true"
      />
      <span
        class="relative z-[1] grid size-7 place-items-center rounded-full border-2 text-xs font-semibold"
        :class="[
          index < currentIndex || (index === currentIndex && step === 'delivered')
            ? 'border-primary bg-primary text-white'
            : index === currentIndex
              ? halted
                ? 'border-rose-500 bg-surface text-rose-600'
                : 'border-brand-500 bg-surface text-brand-600'
              : 'border-slate-300 bg-surface text-slate-400',
        ]"
        :aria-current="index === currentIndex ? 'step' : undefined"
      >
        <Check v-if="index < currentIndex || (index === currentIndex && step === 'delivered')" :size="14" aria-hidden="true" />
        <span v-else>{{ index + 1 }}</span>
      </span>
      <span class="mt-1.5 text-xs leading-tight font-medium" :class="index <= currentIndex ? 'text-slate-800' : 'text-slate-400'">
        {{ statusLabel(step, fulfillment) }}
      </span>
      <span class="tabular text-xs text-slate-500">{{ reachedAt.get(step) && index <= currentIndex ? formatTime(reachedAt.get(step)!) : '' }}</span>
    </li>
  </ol>
</template>
