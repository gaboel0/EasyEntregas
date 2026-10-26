<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { OrderStatus } from '@/types/domain'
import { ALL_ORDER_STATUSES, ORDER_STATUS_LABEL } from '@/modules/orders/orderWorkflow'
import { ORDER_STATUS_TONE } from '@/modules/orders/orderLabels'
import { formatPercent } from '@/utils/format'

/** Distribuição por status em barras horizontais rotuladas (identidade nunca só pela cor). */
const props = defineProps<{ counts: Record<OrderStatus, number>; period?: string }>()

const total = computed(() => ALL_ORDER_STATUSES.reduce((acc, s) => acc + props.counts[s], 0))
const max = computed(() => Math.max(1, ...ALL_ORDER_STATUSES.map((s) => props.counts[s])))
</script>

<template>
  <ul class="space-y-1">
    <li v-for="status in ALL_ORDER_STATUSES" :key="status">
      <RouterLink
        :to="{ name: 'orders', query: { status, period: period ?? 'today' } }"
        class="group grid grid-cols-[9.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 rounded-md px-1.5 py-1 hover:bg-slate-100/70"
        :title="`${counts[status]} pedido(s) ${ORDER_STATUS_LABEL[status].toLowerCase()} — ver lista`"
      >
        <span class="flex items-center gap-2 truncate text-xs text-slate-600">
          <span class="size-2 shrink-0 rounded-full" :class="ORDER_STATUS_TONE[status].dot" aria-hidden="true" />
          {{ ORDER_STATUS_LABEL[status] }}
        </span>
        <span class="h-2 overflow-hidden rounded-full bg-slate-100">
          <span
            class="block h-full rounded-full transition-all"
            :style="{ width: `${(counts[status] / max) * 100}%`, backgroundColor: ORDER_STATUS_TONE[status].hex }"
          />
        </span>
        <span class="tabular text-right text-xs">
          <span class="font-semibold text-slate-900">{{ counts[status] }}</span>
          <span class="ml-1 text-slate-400">{{ total ? formatPercent((counts[status] / total) * 100) : '' }}</span>
        </span>
      </RouterLink>
    </li>
  </ul>
</template>
