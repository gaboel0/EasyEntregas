<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { ArrowLeft, Bike, Clock, MapPin, MapPinOff, Pencil, Phone, SearchX, UserMinus, UserPlus } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import OrderProgress from '@/components/orders/OrderProgress.vue'
import FreightBreakdown from '@/components/deliveries/FreightBreakdown.vue'
import AssignCourierModal from '@/components/deliveries/AssignCourierModal.vue'
import { useOrdersStore } from '@/stores/orders'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { useOrderActions } from '@/composables/useOrderActions'
import { canEditOrder } from '@/modules/orders/orderWorkflow'
import { describeHistoryEntry } from '@/modules/orders/historyText'
import { ORDER_SOURCE_LABEL, ORDER_STATUS_TONE, PAYMENT_METHOD_LABEL } from '@/modules/orders/orderLabels'
import { estimateOrderFreight } from '@/modules/deliveries/deliveryCost'
import { formatCurrency, formatDateTime, formatDuration, formatKm, formatOrderNumber, formatPhone, formatTime, minutesBetween, onlyDigits } from '@/utils/format'

const route = useRoute()
const orders = useOrdersStore()
const settings = useSettingsStore()
const session = useSessionStore()
const actions = useOrderActions()

const view = computed(() => orders.viewById.get(String(route.params.id)) ?? null)
const assignOpen = ref(false)

const statusActions = computed(() => (view.value ? actions.actionsFor(view.value) : []))
const liveEstimate = computed(() => (view.value ? estimateOrderFreight(view.value.order, view.value.courier, settings.current()) : null))
const history = computed(() => (view.value ? [...view.value.history].reverse() : []))

function routeDuration(d: { dispatchedAt: string | null; completedAt: string | null }) {
  if (!d.dispatchedAt) return null
  return minutesBetween(d.dispatchedAt, d.completedAt ?? new Date())
}

const changeDue = computed(() => {
  const v = view.value
  if (!v || v.order.payment.method !== 'cash' || v.order.payment.changeFor === null) return null
  return v.order.payment.changeFor - v.total
})

function historyDot(kind: string, to?: string) {
  if (kind === 'status_change' && to) return ORDER_STATUS_TONE[to as keyof typeof ORDER_STATUS_TONE].dot
  return kind === 'courier_assigned' ? 'bg-brand-500' : 'bg-slate-300'
}
</script>

<template>
  <div v-if="!view" class="card">
    <EmptyState :icon="SearchX" title="Pedido não encontrado" description="Ele pode não existir ou pertencer a outro estabelecimento.">
      <AppButton :to="{ name: 'orders' }">Voltar para pedidos</AppButton>
    </EmptyState>
  </div>
  <div v-else>
    <PageHeader :title="`${formatOrderNumber(view.order.number)} · ${view.order.customerName}`">
      <template #eyebrow>
        <RouterLink :to="{ name: 'orders' }" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft :size="13" aria-hidden="true" /> Pedidos
        </RouterLink>
        <div class="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <StatusBadge :status="view.order.status" size="md" :pickup="view.order.fulfillment === 'pickup'" />
          <span>Recebido em {{ formatDateTime(view.order.createdAt) }} via {{ ORDER_SOURCE_LABEL[view.order.source] }}</span>
          <span v-if="view.isDispatchLate" class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            <Clock :size="12" aria-hidden="true" /> aguardando despacho há {{ formatDuration(view.waitingMinutes) }}
          </span>
        </div>
      </template>
      <template #actions>
        <AppButton v-if="session.can('orders.edit') && canEditOrder(view.order.status)" :icon="Pencil" :to="{ name: 'order-edit', params: { id: view.order.id } }">
          Editar
        </AppButton>
        <AppButton
          v-for="a in statusActions"
          :key="a.to"
          :variant="a.kind === 'primary' ? 'primary' : a.kind === 'danger' ? 'ghost' : 'secondary'"
          :class="a.kind === 'danger' ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : ''"
          :disabled="!!a.blockedReason"
          :title="a.blockedReason"
          :loading="a.kind === 'primary' && actions.isPending(view.order.id)"
          @click="actions.changeStatus(view, a.to)"
        >
          {{ a.label }}
        </AppButton>
      </template>
    </PageHeader>

    <p v-if="statusActions.some((a) => a.blockedReason)" class="-mt-2 mb-4 text-xs text-slate-500">
      {{ statusActions.find((a) => a.blockedReason)?.blockedReason }}
    </p>

    <section class="card mb-5 p-4 sm:p-5" aria-label="Etapas do pedido">
      <OrderProgress :status="view.order.status" :history="view.history" :fulfillment="view.order.fulfillment" />
      <p
        v-if="view.order.status === 'cancelled' || view.order.status === 'delivery_failed'"
        class="mt-4 rounded-lg px-3 py-2 text-sm"
        :class="view.order.status === 'cancelled' ? 'bg-zinc-100 text-zinc-700' : 'bg-rose-50 text-rose-800'"
      >
        <strong>{{ view.order.status === 'cancelled' ? 'Pedido cancelado' : 'Falha na entrega' }}.</strong>
        {{ view.history.filter((h) => h.kind === 'status_change').at(-1)?.note }}
        <template v-if="view.order.status === 'delivery_failed'"> Defina se haverá nova tentativa ou cancelamento.</template>
      </p>
    </section>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="space-y-5">
        <section class="card" aria-labelledby="d-customer">
          <div class="card-header"><h2 id="d-customer" class="card-title">Cliente e endereço</h2></div>
          <div class="grid gap-4 p-4 text-sm sm:grid-cols-2">
            <div>
              <p class="font-medium text-slate-900">{{ view.order.customerName }}</p>
              <a :href="`tel:+55${onlyDigits(view.order.customerPhone)}`" class="tabular mt-0.5 inline-flex items-center gap-1 text-brand-700 hover:underline">
                <Phone :size="13" aria-hidden="true" /> {{ formatPhone(view.order.customerPhone) }}
              </a>
            </div>
            <div v-if="view.order.fulfillment === 'pickup'">
              <p class="font-medium text-slate-900">Retirada no balcão</p>
              <p class="text-slate-500">O cliente busca o pedido no estabelecimento. Sem entrega nem motoboy.</p>
            </div>
            <div v-else>
              <p class="text-slate-900">{{ view.order.address.street }}, {{ view.order.address.number }}</p>
              <p class="text-slate-600">{{ view.order.address.district }} · {{ view.order.address.city }}/{{ view.order.address.state }}</p>
              <p v-if="view.order.address.complement" class="text-slate-600">{{ view.order.address.complement }}</p>
              <p v-if="view.order.address.reference" class="text-slate-500">Ref.: {{ view.order.address.reference }}</p>
            </div>
            <div v-if="view.order.fulfillment !== 'pickup'" class="flex flex-wrap items-center gap-3 text-xs text-slate-600 sm:col-span-2">
              <span class="inline-flex items-center gap-1">
                <MapPin :size="13" aria-hidden="true" />
                {{ formatKm(view.order.address.distanceKm) }} (ida)
                <template v-if="view.order.address.distanceSource === 'straight_line'"> · linha reta</template>
                <template v-else-if="view.order.address.distanceSource === 'manual'"> · informada</template>
                <template v-else> · distância não informada</template>
              </span>
              <RouterLink v-if="view.order.address.location" :to="{ name: 'map', query: { order: view.order.id } }" class="font-medium text-brand-700 hover:underline">Ver no mapa</RouterLink>
              <span v-else class="inline-flex items-center gap-1 text-amber-700"><MapPinOff :size="13" aria-hidden="true" /> Localização ainda precisa ser identificada</span>
            </div>
            <p v-if="view.order.deliveryNotes" class="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 sm:col-span-2">
              <strong class="font-medium">Observação para a entrega:</strong> {{ view.order.deliveryNotes }}
            </p>
          </div>
        </section>

        <section class="card" aria-labelledby="d-items">
          <div class="card-header"><h2 id="d-items" class="card-title">Produtos e pagamento</h2></div>
          <table class="table-base">
            <thead>
              <tr><th scope="col">Produto</th><th scope="col" class="text-right">Qtd.</th><th scope="col" class="text-right">Unitário</th><th scope="col" class="text-right">Subtotal</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in view.order.items" :key="item.id">
                <td>
                  {{ item.name }}
                  <p v-if="item.notes" class="text-xs text-slate-500">{{ item.notes }}</p>
                </td>
                <td class="tabular text-right">{{ item.quantity }}</td>
                <td class="tabular text-right">{{ formatCurrency(item.unitPrice) }}</td>
                <td class="tabular text-right">{{ formatCurrency(item.quantity * item.unitPrice) }}</td>
              </tr>
            </tbody>
          </table>
          <dl class="tabular grid gap-1.5 border-t border-slate-100 p-4 text-sm sm:grid-cols-2">
            <div class="space-y-1.5">
              <div class="flex justify-between gap-4"><dt class="text-slate-500">Forma de pagamento</dt><dd class="font-medium">{{ PAYMENT_METHOD_LABEL[view.order.payment.method] }}</dd></div>
              <div v-if="view.order.payment.method === 'cash'" class="flex justify-between gap-4">
                <dt class="text-slate-500">Troco</dt>
                <dd>{{ view.order.payment.changeFor === null ? 'Não precisa' : `para ${formatCurrency(view.order.payment.changeFor)} (levar ${formatCurrency(changeDue ?? 0)})` }}</dd>
              </div>
            </div>
            <div class="space-y-1.5 sm:border-l sm:border-slate-100 sm:pl-4">
              <div class="flex justify-between"><dt class="text-slate-500">Produtos</dt><dd>{{ formatCurrency(view.order.productsTotal) }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Frete</dt><dd>{{ formatCurrency(view.order.freightFee) }}</dd></div>
              <div class="flex justify-between font-semibold"><dt>Total</dt><dd>{{ formatCurrency(view.total) }}</dd></div>
            </div>
          </dl>
        </section>

        <section class="card" aria-labelledby="d-history">
          <div class="card-header"><h2 id="d-history" class="card-title">Histórico de alterações</h2><span class="text-xs text-slate-500">{{ history.length }} registro(s)</span></div>
          <ol class="divide-y divide-slate-100">
            <li v-for="h in history" :key="h.id" class="flex gap-3 px-4 py-2.5">
              <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="historyDot(h.kind, h.kind === 'status_change' ? h.to : undefined)" aria-hidden="true" />
              <div class="min-w-0 flex-1 text-sm">
                <p class="text-slate-800">{{ describeHistoryEntry(h) }}</p>
                <p v-if="h.note" class="text-xs text-slate-600">“{{ h.note }}”</p>
              </div>
              <div class="tabular shrink-0 text-right text-xs text-slate-500">
                <p>{{ formatDateTime(h.at) }}</p>
                <p>{{ h.actor.name }}</p>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <aside class="space-y-5">
        <section v-if="view.order.fulfillment !== 'pickup'" class="card" aria-labelledby="d-delivery">
          <div class="card-header">
            <h2 id="d-delivery" class="card-title">Entrega</h2>
            <span v-if="view.delivery && view.delivery.attempt > 1" class="text-xs font-medium text-slate-500">{{ view.delivery.attempt }}ª tentativa</span>
          </div>
          <div class="space-y-4 p-4 text-sm">
            <div class="flex items-center gap-3">
              <span class="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true"><Bike :size="18" /></span>
              <div class="min-w-0 flex-1">
                <template v-if="view.courier">
                  <RouterLink :to="{ name: 'courier-detail', params: { id: view.courier.id } }" class="font-medium text-slate-900 hover:text-brand-700">{{ view.courier.name }}</RouterLink>
                  <p class="tabular text-xs text-slate-500">{{ view.courier.link.internalCode }} · {{ formatPhone(view.courier.phone) }}</p>
                </template>
                <p v-else class="text-slate-500">Nenhum motoboy atribuído</p>
              </div>
            </div>
            <div v-if="actions.canAssign(view)" class="flex flex-wrap gap-2">
              <AppButton size="sm" :variant="view.courier ? 'secondary' : 'primary'" :icon="UserPlus" @click="assignOpen = true">
                {{ view.courier ? 'Trocar motoboy' : 'Atribuir motoboy' }}
              </AppButton>
              <AppButton v-if="view.courier" size="sm" variant="ghost" :icon="UserMinus" @click="actions.unassignCourier(view)">Remover</AppButton>
            </div>
            <dl v-if="view.delivery" class="tabular space-y-1 text-xs">
              <div class="flex justify-between"><dt class="text-slate-500">Atribuído às</dt><dd>{{ view.delivery.assignedAt ? formatTime(view.delivery.assignedAt) : '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Saída às</dt><dd>{{ view.delivery.dispatchedAt ? formatTime(view.delivery.dispatchedAt) : '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Encerrada às</dt><dd>{{ view.delivery.completedAt ? formatTime(view.delivery.completedAt) : '—' }}</dd></div>
              <div class="flex justify-between">
                <dt class="text-slate-500">{{ view.delivery.completedAt ? 'Tempo em rota' : 'Em rota há' }}</dt>
                <dd>{{ formatDuration(routeDuration(view.delivery)) }}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section v-if="view.order.fulfillment !== 'pickup'" class="card" aria-labelledby="d-cost">
          <div class="card-header">
            <h2 id="d-cost" class="card-title">Custo e resultado do frete</h2>
            <span class="text-xs text-slate-400">{{ view.economics.frozen ? 'registrado no encerramento' : 'estimativa atual' }}</span>
          </div>
          <div class="p-4">
            <template v-if="view.delivery?.costSnapshot">
              <dl class="tabular space-y-1.5 text-sm">
                <div class="flex justify-between"><dt class="text-slate-500">Distância considerada</dt><dd>{{ formatKm(view.delivery.costSnapshot.distanceUsedKm) }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Combustível</dt><dd>{{ formatCurrency(view.delivery.costSnapshot.fuelCost) }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Outros custos variáveis</dt><dd>{{ formatCurrency(view.delivery.costSnapshot.otherVariableCosts) }}</dd></div>
                <div class="flex justify-between"><dt class="text-slate-500">Remuneração</dt><dd>{{ formatCurrency(view.delivery.costSnapshot.courierPay) }}</dd></div>
                <div class="flex justify-between font-medium"><dt>Custo da entrega</dt><dd>{{ formatCurrency(view.delivery.costSnapshot.operationalCost) }}</dd></div>
                <div class="flex justify-between font-semibold" :class="view.delivery.costSnapshot.result < 0 ? 'text-rose-700' : 'text-emerald-700'">
                  <dt>Resultado do frete</dt><dd>{{ formatCurrency(view.delivery.costSnapshot.result) }}</dd>
                </div>
              </dl>
              <p class="mt-3 text-xs text-slate-500">Valores congelados em {{ formatDateTime(view.delivery.costSnapshot.calculatedAt) }} com os parâmetros vigentes na época.</p>
            </template>
            <FreightBreakdown v-else-if="liveEstimate" :result="liveEstimate" compact />
            <p v-if="view.deliveries.length > 1" class="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Este pedido teve {{ view.deliveries.length }} tentativas de entrega. Os relatórios somam o custo de todas elas.
            </p>
          </div>
        </section>
      </aside>
    </div>

    <AssignCourierModal :open="assignOpen" :view="view" @close="assignOpen = false" />
  </div>
</template>
