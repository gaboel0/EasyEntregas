<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleMinus, Info, TriangleAlert } from 'lucide-vue-next'
import { VERDICT_LABEL, verdictExplanation, type FreightCostResult } from '@/modules/deliveries/freightCalculator'
import { formatCurrency, formatDecimal, formatKm, formatPercent } from '@/utils/format'

const props = withDefaults(defineProps<{ result: FreightCostResult; compact?: boolean }>(), {})

const VERDICT = {
  positive: { icon: CircleCheck, cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', iconCls: 'text-emerald-600' },
  break_even: { icon: CircleMinus, cls: 'border-amber-200 bg-amber-50 text-amber-900', iconCls: 'text-amber-600' },
  negative: { icon: TriangleAlert, cls: 'border-rose-200 bg-rose-50 text-rose-800', iconCls: 'text-rose-600' },
}

const distanceText = computed(() => {
  const r = props.result
  if (!r.distanceKnown) return 'Distância não informada'
  return r.routeMode === 'round_trip'
    ? `${formatKm(r.distanceUsedKm)} (ida e volta: ${formatKm(r.oneWayDistanceKm)} × 2)`
    : `${formatKm(r.distanceUsedKm)} (somente ida)`
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-start gap-2.5 rounded-lg border p-3" :class="VERDICT[result.verdict].cls" role="status">
      <component :is="VERDICT[result.verdict].icon" :size="18" class="mt-0.5 shrink-0" :class="VERDICT[result.verdict].iconCls" aria-hidden="true" />
      <div class="min-w-0">
        <p class="text-sm font-semibold">
          {{ VERDICT_LABEL[result.verdict] }}:
          <span class="tabular">{{ formatCurrency(result.result) }}</span>
          <span v-if="result.marginPct !== null" class="tabular font-normal"> · margem {{ formatPercent(result.marginPct, 1) }}</span>
        </p>
        <p v-if="!compact" class="mt-0.5 text-xs opacity-90">{{ verdictExplanation(result) }}</p>
      </div>
    </div>

    <dl class="tabular divide-y divide-slate-100 text-sm">
      <div class="flex justify-between gap-4 py-1.5">
        <dt class="text-slate-500">Distância considerada</dt>
        <dd class="text-right text-slate-800">{{ distanceText }}</dd>
      </div>
      <div v-if="!compact && result.litersConsumed > 0" class="flex justify-between gap-4 py-1.5">
        <dt class="text-slate-500">Combustível consumido</dt>
        <dd class="text-slate-800">{{ formatDecimal(result.litersConsumed) }} L</dd>
      </div>
      <div class="flex justify-between gap-4 py-1.5">
        <dt class="text-slate-500">Combustível</dt>
        <dd class="text-slate-800">{{ formatCurrency(result.fuelCost) }}</dd>
      </div>
      <div class="flex justify-between gap-4 py-1.5">
        <dt class="text-slate-500">Outros custos variáveis</dt>
        <dd class="text-slate-800">{{ formatCurrency(result.otherVariableCosts) }}</dd>
      </div>
      <div class="flex justify-between gap-4 py-1.5">
        <dt class="text-slate-500">Remuneração do motoboy</dt>
        <dd class="text-slate-800">{{ formatCurrency(result.courierPay) }}</dd>
      </div>
      <div class="flex justify-between gap-4 py-1.5 font-medium">
        <dt class="text-slate-700">Custo operacional estimado</dt>
        <dd class="text-slate-900">{{ formatCurrency(result.operationalCost) }}</dd>
      </div>
      <div class="flex justify-between gap-4 py-1.5 font-medium">
        <dt class="text-slate-700">Frete cobrado do cliente</dt>
        <dd class="text-slate-900">{{ formatCurrency(result.freightCharged) }}</dd>
      </div>
    </dl>

    <ul v-if="result.limitations.length" class="space-y-1">
      <li v-for="l in result.limitations" :key="l" class="flex gap-1.5 text-xs text-slate-500">
        <Info :size="13" class="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /> {{ l }}
      </li>
    </ul>
  </div>
</template>
