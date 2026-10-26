<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TriangleAlert, UserX } from 'lucide-vue-next'
import type { OrderView } from '@/modules/orders/orderViews'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import CourierStatusBadge from '@/components/ui/CourierStatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useFleetStore } from '@/stores/fleet'
import { useOrdersStore } from '@/stores/orders'
import { useSettingsStore } from '@/stores/settings'
import { useOrderActions } from '@/composables/useOrderActions'
import { estimateOrderFreight } from '@/modules/deliveries/deliveryCost'
import { describeCompensation } from '@/modules/couriers/courierLabels'
import { formatCurrency, formatKm, formatOrderNumber } from '@/utils/format'
import { useNow } from '@/composables/useNow'

const props = defineProps<{ open: boolean; view: OrderView | null }>()
const emit = defineEmits<{ close: []; assigned: [] }>()

const fleet = useFleetStore()
const orders = useOrdersStore()
const settings = useSettingsStore()
const actions = useOrderActions()
const now = useNow()

const selected = ref<string>('')
const saving = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) selected.value = props.view?.delivery?.courierId ?? ''
  },
)

const deliveredToday = computed(() => {
  const today = now.value.toDateString()
  const counts = new Map<string, number>()
  for (const d of orders.deliveries) {
    if (d.status === 'delivered' && d.courierId && d.completedAt && new Date(d.completedAt).toDateString() === today) {
      counts.set(d.courierId, (counts.get(d.courierId) ?? 0) + 1)
    }
  }
  return counts
})

const STATUS_ORDER = { available: 0, busy: 1, unavailable: 2 }

const options = computed(() => {
  const view = props.view
  if (!view) return []
  return [...fleet.views]
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.activeDeliveries.length - b.activeDeliveries.length)
    .map((c) => ({
      view: c,
      estimate: estimateOrderFreight(view.order, c.profile, settings.current()),
      isCurrent: view.delivery?.courierId === c.profile.id,
      disabled: c.status === 'unavailable',
    }))
})

const choice = computed(() => options.value.find((o) => o.view.profile.id === selected.value) ?? null)

async function confirm() {
  if (!props.view || !choice.value) return
  saving.value = true
  const ok = await actions.assignCourier(props.view, choice.value.view.profile.id, choice.value.view.profile.name)
  saving.value = false
  if (ok) {
    emit('assigned')
    emit('close')
  }
}
</script>

<template>
  <AppModal
    :open="open"
    size="lg"
    :title="view ? `Atribuir motoboy ao pedido ${formatOrderNumber(view.order.number)}` : 'Atribuir motoboy'"
    :description="view ? `${view.order.customerName} · ${view.order.address.street}, ${view.order.address.number} — ${view.order.address.district} · ${formatKm(view.order.address.distanceKm)} (ida)` : undefined"
    @close="emit('close')"
  >
    <fieldset v-if="options.length">
      <legend class="sr-only">Selecione o motoboy</legend>
      <p class="mb-3 text-xs text-slate-500">
        O custo e o resultado consideram a remuneração de cada motoboy e quem paga os custos do veículo. Frete cobrado:
        <strong class="text-slate-700">{{ formatCurrency(view?.order.freightFee ?? 0) }}</strong>.
      </p>
      <div class="space-y-2">
        <label
          v-for="o in options"
          :key="o.view.profile.id"
          class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors"
          :class="[
            selected === o.view.profile.id ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-400' : 'border-transparent bg-slate-100/60 hover:bg-slate-100',
            o.disabled ? 'cursor-not-allowed opacity-55' : '',
          ]"
        >
          <input v-model="selected" type="radio" name="courier" :value="o.view.profile.id" :disabled="o.disabled" :aria-label="o.view.profile.name" class="mt-1 accent-brand-600" />
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-semibold text-slate-900">{{ o.view.profile.name }}</span>
              <span class="text-xs text-slate-400">{{ o.view.profile.link.internalCode }}</span>
              <CourierStatusBadge :status="o.view.status" :overloaded="o.view.overloaded" />
              <span v-if="o.isCurrent" class="text-xs font-medium text-brand-700">atual</span>
            </span>
            <span class="mt-1 block text-xs text-slate-500">
              {{ o.view.activeDeliveries.length }}/{{ settings.settings?.maxConcurrentDeliveriesPerCourier }} entregas ativas ·
              {{ deliveredToday.get(o.view.profile.id) ?? 0 }} entregues hoje · {{ describeCompensation(o.view.profile.link.compensation) }}
            </span>
          </span>
          <span class="tabular shrink-0 text-right text-xs">
            <span class="block text-slate-500">custo {{ formatCurrency(o.estimate.operationalCost) }}</span>
            <span class="block font-semibold" :class="o.estimate.result < 0 ? 'text-rose-700' : 'text-emerald-700'">
              {{ o.estimate.result >= 0 ? '+' : '' }}{{ formatCurrency(o.estimate.result) }}
            </span>
          </span>
        </label>
      </div>
      <p v-if="choice?.view.overloaded" class="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900" role="alert">
        <TriangleAlert :size="14" class="mt-0.5 shrink-0" aria-hidden="true" />
        {{ choice.view.profile.name }} já está no limite de {{ settings.settings?.maxConcurrentDeliveriesPerCourier }} entregas simultâneas. A atribuição é permitida, mas pode atrasar as entregas.
      </p>
      <p v-if="choice && !choice.estimate.distanceKnown" class="mt-3 text-xs text-slate-500">Sem distância informada, o custo considera apenas valores fixos.</p>
    </fieldset>
    <EmptyState v-else :icon="UserX" title="Nenhum motoboy cadastrado" description="Cadastre motoboys para poder atribuir entregas." />
    <template #footer>
      <AppButton @click="emit('close')">Cancelar</AppButton>
      <AppButton variant="primary" :disabled="!choice || choice.isCurrent" :loading="saving" @click="confirm">
        {{ choice ? `Atribuir ${choice.view.profile.name.split(' ')[0]}` : 'Selecione um motoboy' }}
      </AppButton>
    </template>
  </AppModal>
</template>
