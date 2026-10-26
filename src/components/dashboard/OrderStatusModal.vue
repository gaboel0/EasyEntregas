<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Check, TriangleAlert, UserMinus, UserPlus } from 'lucide-vue-next'
import type { ID } from '@/types/domain'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useOrdersStore } from '@/stores/orders'
import { useFleetStore } from '@/stores/fleet'
import { useSettingsStore } from '@/stores/settings'
import { useOrderActions } from '@/composables/useOrderActions'
import { COURIER_STATUS_LABEL } from '@/modules/couriers/courierLabels'
import { ORDER_SOURCE_LABEL, PAYMENT_METHOD_LABEL } from '@/modules/orders/orderLabels'
import { canEditOrder } from '@/modules/orders/orderWorkflow'
import { formatCurrency, formatDuration, formatKm, formatOrderNumber, formatTime } from '@/utils/format'

/**
 * Acompanhamento rápido de um pedido: altera o status (respeitando o fluxo) e indica o motoboy.
 * Fica aberto após cada alteração, lendo o pedido atualizado da store; ao ficar pronto sem
 * motoboy, destaca a escolha do entregador.
 */
const props = defineProps<{ orderId: ID | null }>()
const emit = defineEmits<{ close: [] }>()

const orders = useOrdersStore()
const fleet = useFleetStore()
const settings = useSettingsStore()
const actions = useOrderActions()

const view = computed(() => (props.orderId ? (orders.viewById.get(props.orderId) ?? null) : null))
const statusActions = computed(() => (view.value ? actions.actionsFor(view.value) : []))
const blocked = computed(() => statusActions.value.find((a) => a.blockedReason)?.blockedReason)

const courierId = ref('')
const assigning = ref(false)
watch(
  () => props.orderId,
  () => (courierId.value = ''),
)

const courierOptions = computed(() =>
  [...fleet.views].sort((a, b) => ({ available: 0, busy: 1, unavailable: 2 })[a.status] - ({ available: 0, busy: 1, unavailable: 2 })[b.status] || a.activeDeliveries.length - b.activeDeliveries.length),
)

/** Pronto para sair e sem motoboy: é a hora de indicar o entregador. */
const isPickupOrder = computed(() => view.value?.order.fulfillment === 'pickup')
const needsCourier = computed(
  () => !!view.value && !isPickupOrder.value && !view.value.courier && ['ready_for_pickup', 'awaiting_courier'].includes(view.value.order.status),
)
const canAssign = computed(() => !!view.value && actions.canAssign(view.value))

async function assign() {
  const option = courierOptions.value.find((c) => c.profile.id === courierId.value)
  if (!view.value || !option) return
  assigning.value = true
  const ok = await actions.assignCourier(view.value, option.profile.id, option.profile.name)
  assigning.value = false
  if (ok) courierId.value = ''
}
</script>

<template>
  <AppModal
    :open="!!view"
    size="lg"
    :title="view ? `${formatOrderNumber(view.order.number)} ${view.order.customerName}` : ''"
    :description="view ? `${ORDER_SOURCE_LABEL[view.order.source]}, recebido às ${formatTime(view.order.createdAt)}` : undefined"
    @close="emit('close')"
  >
    <div v-if="view" class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge :status="view.order.status" size="md" :pickup="isPickupOrder" />
        <p class="tabular text-lg font-semibold text-slate-900">{{ formatCurrency(view.total) }}</p>
      </div>

      <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-xs text-slate-500">{{ isPickupOrder ? 'Entrega' : 'Endereço' }}</dt>
          <dd v-if="isPickupOrder" class="text-slate-800">Retirada no balcão pelo cliente</dd>
          <template v-else>
            <dd class="text-slate-800">{{ view.order.address.street }}, {{ view.order.address.number }}, {{ view.order.address.district }}</dd>
            <dd class="text-xs text-slate-500">{{ formatKm(view.order.address.distanceKm) }} de ida</dd>
          </template>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Produtos</dt>
          <dd class="text-slate-800">{{ view.order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ') }}</dd>
          <dd class="text-xs text-slate-500">Pagamento: {{ PAYMENT_METHOD_LABEL[view.order.payment.method] }}</dd>
        </div>
      </dl>

      <section aria-labelledby="status-title">
        <h3 id="status-title" class="mb-2 text-sm font-semibold text-slate-900">Alterar status</h3>
        <div v-if="statusActions.length" class="flex flex-wrap gap-2">
          <AppButton
            v-for="a in statusActions"
            :key="a.to"
            :variant="a.kind === 'primary' ? 'primary' : a.kind === 'danger' ? 'ghost' : 'secondary'"
            :class="a.kind === 'danger' ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : ''"
            :disabled="!!a.blockedReason"
            :title="a.blockedReason"
            :loading="actions.isPending(view.order.id) && a.kind === 'primary'"
            @click="actions.changeStatus(view, a.to)"
          >
            {{ a.label }}
          </AppButton>
        </div>
        <p v-else class="flex items-center gap-1.5 text-sm text-slate-500"><Check :size="15" aria-hidden="true" /> Este pedido já foi encerrado.</p>
        <p v-if="blocked" class="mt-2 text-xs text-slate-500">{{ blocked }}</p>
      </section>

      <section v-if="!isPickupOrder" aria-labelledby="courier-title" class="rounded-xl p-3 transition-colors" :class="needsCourier ? 'bg-amber-50' : 'bg-slate-100/50'">
        <h3 id="courier-title" class="text-sm font-semibold text-slate-900">Motoboy</h3>
        <p v-if="needsCourier" class="mt-1 flex items-start gap-1.5 text-sm text-amber-900" role="status">
          <TriangleAlert :size="15" class="mt-0.5 shrink-0" aria-hidden="true" />
          Pedido pronto{{ view.waitingMinutes !== null ? ` há ${formatDuration(view.waitingMinutes)}` : '' }}. Indique o motoboy para ele poder sair.
        </p>

        <p v-if="view.courier" class="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          {{ view.courier.name }}
          <AppButton v-if="canAssign" size="sm" variant="ghost" :icon="UserMinus" @click="actions.unassignCourier(view)">Remover</AppButton>
        </p>
        <p v-else-if="!canAssign" class="mt-1 text-sm text-slate-500">Nenhum motoboy neste pedido.</p>

        <div v-if="canAssign" class="mt-2 flex flex-wrap gap-2">
          <select v-model="courierId" class="field-input min-w-0 flex-1" aria-label="Escolher motoboy">
            <option value="" disabled>{{ view.courier ? 'Trocar por…' : 'Escolher motoboy…' }}</option>
            <option v-for="c in courierOptions" :key="c.profile.id" :value="c.profile.id" :disabled="c.status === 'unavailable' || c.profile.id === view.courier?.id">
              {{ c.profile.name }}, {{ COURIER_STATUS_LABEL[c.status].toLowerCase() }}, {{ c.activeDeliveries.length }}/{{ settings.settings?.maxConcurrentDeliveriesPerCourier }} entregas
            </option>
          </select>
          <AppButton variant="primary" :icon="UserPlus" :disabled="!courierId" :loading="assigning" @click="assign">Atribuir</AppButton>
        </div>
      </section>
    </div>

    <template #footer>
      <RouterLink v-if="view && canEditOrder(view.order.status)" :to="{ name: 'order-edit', params: { id: view.order.id } }" class="mr-auto text-sm text-slate-600 hover:text-slate-900">Editar pedido</RouterLink>
      <AppButton v-if="view" :to="{ name: 'order-detail', params: { id: view.order.id } }">Ver detalhes</AppButton>
      <AppButton variant="primary" @click="emit('close')">Fechar</AppButton>
    </template>
  </AppModal>
</template>
