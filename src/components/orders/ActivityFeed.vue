<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useOrdersStore } from '@/stores/orders'
import { describeHistoryEntry } from '@/modules/orders/historyText'
import { ORDER_STATUS_TONE } from '@/modules/orders/orderLabels'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatOrderNumber, formatTime } from '@/utils/format'
import { Activity } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 12 })
const orders = useOrdersStore()

const entries = computed(() =>
  [...orders.history]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, props.limit)
    .map((entry) => ({ entry, order: orders.viewById.get(entry.orderId)?.order })),
)

function dotClass(entry: (typeof entries.value)[number]['entry']) {
  if (entry.kind === 'status_change') return ORDER_STATUS_TONE[entry.to].dot
  if (entry.kind === 'courier_assigned') return 'bg-brand-500'
  return 'bg-slate-300'
}
</script>

<template>
  <ol v-if="entries.length" class="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-slate-200">
    <li v-for="{ entry, order } in entries" :key="entry.id" class="relative flex gap-3 pl-0">
      <span class="relative z-[1] mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface" :class="dotClass(entry)" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="text-sm text-slate-800">
          <RouterLink v-if="order" :to="{ name: 'order-detail', params: { id: order.id } }" class="font-semibold text-slate-900 hover:text-brand-700">
            {{ formatOrderNumber(order.number) }}
          </RouterLink>
          {{ describeHistoryEntry(entry) }}
        </p>
        <p class="text-xs text-slate-500">
          <span class="tabular">{{ formatTime(entry.at) }}</span> · {{ entry.actor.name }}
          <span v-if="entry.note" class="text-slate-400"> · {{ entry.note }}</span>
        </p>
      </div>
    </li>
  </ol>
  <EmptyState v-else compact :icon="Activity" title="Nenhuma atividade registrada" />
</template>
