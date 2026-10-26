<script setup lang="ts">
import type { CourierStatus } from '@/types/domain'
import { COURIER_STATUS_LABEL, COURIER_STATUS_TONE } from '@/modules/couriers/courierLabels'

defineProps<{ status: CourierStatus; overloaded?: boolean }>()
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset" :class="COURIER_STATUS_TONE[status]">
      {{ COURIER_STATUS_LABEL[status] }}
    </span>
    <span
      v-if="overloaded && status !== 'unavailable'"
      class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800 ring-1 ring-amber-300 ring-inset"
    >
      No limite
    </span>
  </span>
</template>
