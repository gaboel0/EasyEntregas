<script setup lang="ts">
import type { OrderStatus } from '@/types/domain'
import { ORDER_STATUS_LABEL } from '@/modules/orders/orderWorkflow'
import { ORDER_STATUS_TONE } from '@/modules/orders/orderLabels'

defineProps<{ status: OrderStatus; size?: 'sm' | 'md' }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset"
    :class="[ORDER_STATUS_TONE[status].badge, size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]']"
  >
    <span class="size-1.5 rounded-full" :class="ORDER_STATUS_TONE[status].dot" aria-hidden="true" />
    {{ ORDER_STATUS_LABEL[status] }}
  </span>
</template>
