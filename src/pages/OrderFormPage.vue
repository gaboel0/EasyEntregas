<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, RouterLink } from 'vue-router'
import { ArrowLeft, Lock, MapPin, SearchX } from 'lucide-vue-next'
import type { DistanceSource, Fulfillment, GeoPoint, OrderSource, PaymentMethod } from '@/types/domain'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormField from '@/components/ui/FormField.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import OrderItemsEditor, { type ItemDraft } from '@/components/orders/OrderItemsEditor.vue'
import LocationPicker from '@/components/map/LocationPicker.vue'
import FreightBreakdown from '@/components/deliveries/FreightBreakdown.vue'
import { useOrdersStore } from '@/stores/orders'
import { useCouriersStore } from '@/stores/couriers'
import { useFleetStore } from '@/stores/fleet'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { useZodForm } from '@/composables/useZodForm'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { orderInputSchema, orderTotal, productsTotal } from '@/modules/orders/orderSchema'
import { ORDER_SOURCE_LABEL, ORDER_SOURCES, PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from '@/modules/orders/orderLabels'
import { canEditOrder } from '@/modules/orders/orderWorkflow'
import { estimateOrderFreight } from '@/modules/deliveries/deliveryCost'
import { COURIER_STATUS_LABEL } from '@/modules/couriers/courierLabels'
import { straightLineKm } from '@/utils/geo'
import { formatCurrency, formatOrderNumber, formatPhone } from '@/utils/format'
import { errorMessage } from '@/services'

const route = useRoute()
const router = useRouter()
const orders = useOrdersStore()
const couriers = useCouriersStore()
const fleet = useFleetStore()
const settingsStore = useSettingsStore()
const session = useSessionStore()
const toast = useToast()
const { confirm } = useConfirm()

const editingId = computed(() => (route.name === 'order-edit' ? String(route.params.id) : null))
const editing = computed(() => (editingId.value ? orders.viewById.get(editingId.value) ?? null : null))
const settings = settingsStore.current()

interface FormState {
  fulfillment: Fulfillment
  customerName: string
  customerPhone: string
  address: {
    street: string
    number: string
    district: string
    city: string
    state: string
    complement: string
    reference: string
    location: GeoPoint | null
    distanceKm: number | null
    distanceSource: DistanceSource | null
  }
  source: OrderSource | ''
  items: ItemDraft[]
  freightFee: number | null
  payment: { method: PaymentMethod | ''; changeFor: number | null }
  deliveryNotes: string
  courierId: string
}

function initialState(): FormState {
  const v = editing.value
  const est = session.establishment
  if (v) {
    const o = v.order
    return {
      fulfillment: o.fulfillment ?? 'delivery',
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      address: {
        street: o.address.street,
        number: o.address.number,
        district: o.address.district,
        city: o.address.city,
        state: o.address.state,
        complement: o.address.complement ?? '',
        reference: o.address.reference ?? '',
        location: o.address.location,
        distanceKm: o.address.distanceKm,
        distanceSource: o.address.distanceSource,
      },
      source: o.source,
      items: o.items.map((i) => ({ key: i.id, id: i.id, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes ?? '' })),
      freightFee: o.freightFee,
      payment: { method: o.payment.method, changeFor: o.payment.changeFor },
      deliveryNotes: o.deliveryNotes ?? '',
      courierId: v.delivery?.courierId ?? '',
    }
  }
  return {
    fulfillment: 'delivery',
    customerName: '',
    customerPhone: '',
    address: {
      street: '',
      number: '',
      district: '',
      city: est?.address.city ?? '',
      state: est?.address.state ?? '',
      complement: '',
      reference: '',
      location: null,
      distanceKm: null,
      distanceSource: null,
    },
    source: 'whatsapp',
    items: [{ key: 'first', name: '', quantity: 1, unitPrice: null, notes: '' }],
    freightFee: settings.defaultFreightFee,
    payment: { method: 'pix', changeFor: null },
    deliveryNotes: '',
    courierId: '',
  }
}

const form = reactive<FormState>(initialState())
const pristine = ref(JSON.stringify(form))
const dirty = computed(() => JSON.stringify(form) !== pristine.value)
const saving = ref(false)
const showMap = ref(!!form.address.location)
const { error, validate, revalidate, focusFirstError } = useZodForm(orderInputSchema)

function payload() {
  return {
    ...form,
    customerPhone: form.customerPhone,
    // Retirada no balcão: sem endereço, distância, frete nem motoboy.
    address:
      form.fulfillment === 'pickup'
        ? { street: '', number: '', district: '', city: '', state: '', location: null, distanceKm: null, distanceSource: null }
        : { ...form.address, complement: form.address.complement || undefined, reference: form.address.reference || undefined },
    freightFee: form.fulfillment === 'pickup' ? 0 : form.freightFee,
    items: form.items.map(({ id, name, quantity, unitPrice, notes }) => ({ id, name, quantity, unitPrice, notes: notes || undefined })),
    payment: { method: form.payment.method, changeFor: form.payment.method === 'cash' ? form.payment.changeFor : null },
    deliveryNotes: form.deliveryNotes || undefined,
    courierId: editing.value || form.fulfillment === 'pickup' ? undefined : form.courierId || null,
  }
}

watch(form, () => revalidate(payload()), { deep: true })

const isPickupForm = computed(() => form.fulfillment === 'pickup')
const fulfillmentOptions = [
  { value: 'delivery' as Fulfillment, label: 'Entrega' },
  { value: 'pickup' as Fulfillment, label: 'Retirada no balcão' },
]
watch(
  () => form.fulfillment,
  (value) => {
    form.freightFee = value === 'pickup' ? 0 : settings.defaultFreightFee
    if (value === 'pickup') form.courierId = ''
  },
)

// Distância: o usuário pode digitar (manual) ou derivá-la do ponto no mapa (linha reta).
const origin = computed(() => session.establishment?.location ?? null)
watch(
  () => form.address.location,
  (loc) => {
    if (!loc || !origin.value) return
    if (form.address.distanceSource === 'manual' && form.address.distanceKm !== null) return
    form.address.distanceKm = Math.round(straightLineKm(origin.value, loc) * 10) / 10
    form.address.distanceSource = 'straight_line'
  },
)

function onDistanceInput(value: number | null) {
  form.address.distanceKm = value
  form.address.distanceSource = value === null ? null : 'manual'
}

function useStraightLine() {
  if (!form.address.location || !origin.value) return
  form.address.distanceKm = Math.round(straightLineKm(origin.value, form.address.location) * 10) / 10
  form.address.distanceSource = 'straight_line'
}

const subtotal = computed(() => productsTotal(form.items.map((i) => ({ quantity: i.quantity ?? 0, unitPrice: i.unitPrice ?? 0 }))))
const total = computed(() => orderTotal(form.items.map((i) => ({ quantity: i.quantity ?? 0, unitPrice: i.unitPrice ?? 0 })), form.freightFee ?? 0))
const change = computed(() => (form.payment.changeFor !== null && form.payment.changeFor >= total.value ? form.payment.changeFor - total.value : null))

const selectableCouriers = computed(() => fleet.views.filter((c) => c.status !== 'unavailable'))
const selectedCourier = computed(() => couriers.couriers.find((c) => c.id === form.courierId) ?? null)
const estimate = computed(() =>
  estimateOrderFreight(
    { address: { ...form.address, complement: undefined, reference: undefined }, freightFee: form.freightFee ?? 0 },
    selectedCourier.value,
    settings,
  ),
)

async function submit(andNew = false) {
  const data = validate(payload())
  if (!data) {
    toast.error('Revise os campos destacados', 'Alguns dados obrigatórios estão faltando ou inválidos.')
    focusFirstError()
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      const saved = await orders.update(editing.value.order.id, data)
      pristine.value = JSON.stringify(form)
      toast.success(`Pedido ${formatOrderNumber(saved.number)} atualizado`)
      router.push({ name: 'order-detail', params: { id: saved.id } })
    } else {
      const saved = await orders.create(data)
      toast.success(`Pedido ${formatOrderNumber(saved.number)} cadastrado`, `${saved.customerName} · ${formatCurrency(total.value)}`)
      if (andNew) {
        Object.assign(form, initialState())
        pristine.value = JSON.stringify(form)
        showMap.value = false
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        pristine.value = JSON.stringify(form)
        router.push({ name: 'order-detail', params: { id: saved.id } })
      }
    }
  } catch (e) {
    toast.error('Não foi possível salvar o pedido', errorMessage(e))
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(async () => {
  if (!dirty.value || saving.value) return true
  const { confirmed } = await confirm({
    title: 'Descartar alterações?',
    description: 'Os dados preenchidos neste formulário serão perdidos.',
    confirmLabel: 'Descartar',
    cancelLabel: 'Continuar editando',
    tone: 'danger',
  })
  return confirmed
})
</script>

<template>
  <div v-if="editingId && !editing" class="card">
    <EmptyState :icon="SearchX" title="Pedido não encontrado" description="Ele pode ter sido removido ou pertence a outro estabelecimento.">
      <AppButton :to="{ name: 'orders' }">Voltar para pedidos</AppButton>
    </EmptyState>
  </div>
  <div v-else-if="editing && !canEditOrder(editing.order.status)" class="card">
    <EmptyState :icon="Lock" title="Este pedido não pode mais ser editado" description="Pedidos entregues ou cancelados ficam bloqueados para preservar o histórico.">
      <AppButton :to="{ name: 'order-detail', params: { id: editing.order.id } }">Ver pedido</AppButton>
    </EmptyState>
  </div>
  <form v-else novalidate @submit.prevent="submit(false)">
    <PageHeader
      :title="editing ? `Editar pedido ${formatOrderNumber(editing.order.number)}` : 'Novo pedido'"
      :description="editing ? 'As alterações ficam registradas no histórico do pedido.' : 'Registre um pedido recebido por WhatsApp, Instagram, telefone ou balcão.'"
    >
      <template #eyebrow>
        <RouterLink
          :to="editing ? { name: 'order-detail', params: { id: editing.order.id } } : { name: 'orders' }"
          class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft :size="13" aria-hidden="true" /> {{ editing ? 'Voltar ao pedido' : 'Pedidos' }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-5">
        <section class="card" aria-labelledby="sec-customer">
          <div class="card-header"><h2 id="sec-customer" class="card-title">Cliente e origem</h2></div>
          <div class="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div class="sm:col-span-2 lg:col-span-3">
              <p class="mb-1 text-xs font-medium text-slate-700">Como o cliente recebe</p>
              <SegmentedControl v-if="!editing" v-model="form.fulfillment" :options="fulfillmentOptions" label="Como o cliente recebe" />
              <p v-else class="text-sm text-slate-800">{{ isPickupForm ? 'Retirada no balcão' : 'Entrega' }} <span class="text-xs text-slate-500">(não pode ser alterado depois de cadastrado)</span></p>
            </div>
            <FormField v-slot="{ id, invalid, describedby }" label="Nome do cliente" required :error="error('customerName')">
              <input :id="id" v-model="form.customerName" class="field-input" autocomplete="off" maxlength="120" :aria-invalid="invalid || undefined" :aria-describedby="describedby" autofocus />
            </FormField>
            <FormField v-slot="{ id, invalid, describedby }" label="Telefone" required :error="error('customerPhone')" hint="Com DDD">
              <input
                :id="id"
                v-model="form.customerPhone"
                class="field-input tabular"
                inputmode="tel"
                autocomplete="off"
                placeholder="(11) 99999-0000"
                maxlength="20"
                :aria-invalid="invalid || undefined"
                :aria-describedby="describedby"
                @blur="form.customerPhone = formatPhone(form.customerPhone)"
              />
            </FormField>
            <FormField v-slot="{ id, invalid }" label="Origem do pedido" required :error="error('source')">
              <select :id="id" v-model="form.source" class="field-input" :aria-invalid="invalid || undefined">
                <option v-for="s in ORDER_SOURCES" :key="s" :value="s">{{ ORDER_SOURCE_LABEL[s] }}</option>
              </select>
            </FormField>
          </div>
        </section>

        <section v-if="!isPickupForm" class="card" aria-labelledby="sec-address">
          <div class="card-header"><h2 id="sec-address" class="card-title">Endereço de entrega</h2></div>
          <div class="grid gap-4 p-4 sm:grid-cols-6">
            <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-4" label="Rua / avenida" required :error="error('address.street')">
              <input :id="id" v-model="form.address.street" class="field-input" maxlength="160" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
            </FormField>
            <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Número" required :error="error('address.number')">
              <input :id="id" v-model="form.address.number" class="field-input" maxlength="20" placeholder="Ex.: 120 ou S/N" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
            </FormField>
            <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Bairro" required :error="error('address.district')">
              <input :id="id" v-model="form.address.district" class="field-input" maxlength="80" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
            </FormField>
            <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-3" label="Cidade" required :error="error('address.city')">
              <input :id="id" v-model="form.address.city" class="field-input" maxlength="80" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
            </FormField>
            <FormField v-slot="{ id, invalid, describedby }" label="UF" required :error="error('address.state')">
              <input :id="id" v-model="form.address.state" class="field-input uppercase" maxlength="2" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
            </FormField>
            <FormField v-slot="{ id, invalid }" class="sm:col-span-3" label="Complemento" :error="error('address.complement')">
              <input :id="id" v-model="form.address.complement" class="field-input" maxlength="120" placeholder="Apto, bloco, casa…" :aria-invalid="invalid || undefined" />
            </FormField>
            <FormField v-slot="{ id, invalid }" class="sm:col-span-3" label="Ponto de referência" :error="error('address.reference')">
              <input :id="id" v-model="form.address.reference" class="field-input" maxlength="160" placeholder="Ex.: em frente à padaria" :aria-invalid="invalid || undefined" />
            </FormField>

            <FormField
              v-slot="{ id, invalid, describedby }"
              class="sm:col-span-2"
              label="Distância estimada (só ida)"
              :error="error('address.distanceKm')"
              :hint="
                form.address.distanceSource === 'straight_line'
                  ? 'Calculada em linha reta pelo mapa — o percurso real tende a ser maior.'
                  : form.address.distanceSource === 'manual'
                    ? 'Informada manualmente.'
                    : 'Opcional, mas necessária para estimar o custo.'
              "
            >
              <NumberInput :id="id" :model-value="form.address.distanceKm" suffix="km" :decimals="1" :invalid="invalid" :describedby="describedby" @update:model-value="onDistanceInput" />
            </FormField>
            <div class="flex flex-wrap items-start gap-2 sm:col-span-4 sm:pt-5">
              <AppButton size="sm" :icon="MapPin" @click="showMap = !showMap">{{ showMap ? 'Ocultar mapa' : form.address.location ? 'Ajustar no mapa' : 'Marcar no mapa' }}</AppButton>
              <AppButton v-if="form.address.location && form.address.distanceSource === 'manual'" size="sm" variant="ghost" @click="useStraightLine">Usar distância em linha reta</AppButton>
              <AppButton v-if="form.address.location" size="sm" variant="ghost" @click="form.address.location = null">Remover localização</AppButton>
              <p v-if="!form.address.location" class="w-full text-xs text-slate-500">Sem localização o pedido aparece no mapa como “localização pendente”.</p>
            </div>
            <div v-if="showMap" class="sm:col-span-6">
              <LocationPicker v-model="form.address.location" :origin="origin" />
              <p class="mt-1 text-xs text-slate-500">Clique no mapa ou arraste o marcador até o endereço. A busca automática de endereços exige um serviço de geocodificação (ainda não conectado).</p>
            </div>
          </div>
        </section>

        <section class="card" aria-labelledby="sec-items">
          <div class="card-header">
            <h2 id="sec-items" class="card-title">Produtos</h2>
            <span class="tabular text-sm text-slate-500">Subtotal {{ formatCurrency(subtotal) }}</span>
          </div>
          <div class="p-4">
            <OrderItemsEditor v-model="form.items" :error="error" />
            <p v-if="error('items')" class="mt-2 text-xs text-rose-600" role="alert">{{ error('items') }}</p>
          </div>
        </section>

        <section class="card" aria-labelledby="sec-payment">
          <div class="card-header"><h2 id="sec-payment" class="card-title">Pagamento e entrega</h2></div>
          <div class="grid gap-4 p-4 sm:grid-cols-3">
            <FormField v-if="!isPickupForm" v-slot="{ id, invalid, describedby }" label="Valor do frete" required :error="error('freightFee')" hint="Cobrado do cliente pela entrega">
              <NumberInput :id="id" v-model="form.freightFee" prefix="R$" :invalid="invalid" :describedby="describedby" />
            </FormField>
            <FormField v-slot="{ id, invalid }" label="Forma de pagamento" required :error="error('payment.method')">
              <select :id="id" v-model="form.payment.method" class="field-input" :aria-invalid="invalid || undefined">
                <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ PAYMENT_METHOD_LABEL[m] }}</option>
              </select>
            </FormField>
            <FormField
              v-if="form.payment.method === 'cash'"
              v-slot="{ id, invalid, describedby }"
              label="Troco para"
              :error="error('payment.changeFor')"
              :hint="change !== null ? `Levar ${formatCurrency(change)} de troco` : 'Deixe vazio se não precisar de troco'"
            >
              <NumberInput :id="id" v-model="form.payment.changeFor" prefix="R$" :invalid="invalid" :describedby="describedby" />
            </FormField>
            <FormField v-slot="{ id, invalid }" class="sm:col-span-3" label="Observações para a entrega" :error="error('deliveryNotes')">
              <textarea :id="id" v-model="form.deliveryNotes" rows="2" class="field-input resize-y" maxlength="500" placeholder="Ex.: tocar o interfone 2 vezes" :aria-invalid="invalid || undefined" />
            </FormField>
            <FormField
              v-if="!editing && !isPickupForm && session.can('dispatch.assign')"
              v-slot="{ id }"
              class="sm:col-span-3"
              label="Motoboy responsável (opcional)"
              hint="Você também pode atribuir depois, na tela de despacho."
            >
              <select :id="id" v-model="form.courierId" class="field-input">
                <option value="">Definir depois</option>
                <option v-for="c in selectableCouriers" :key="c.profile.id" :value="c.profile.id">
                  {{ c.profile.name }} — {{ COURIER_STATUS_LABEL[c.status] }}, {{ c.activeDeliveries.length }} entrega(s) ativa(s){{ c.overloaded ? ' · no limite' : '' }}
                </option>
              </select>
            </FormField>
          </div>
        </section>
      </div>

      <aside class="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <section class="card" aria-labelledby="sec-summary">
          <div class="card-header"><h2 id="sec-summary" class="card-title">Resumo do pedido</h2></div>
          <dl class="tabular space-y-1.5 p-4 text-sm">
            <div class="flex justify-between"><dt class="text-slate-500">Produtos</dt><dd>{{ formatCurrency(subtotal) }}</dd></div>
            <div v-if="!isPickupForm" class="flex justify-between"><dt class="text-slate-500">Frete</dt><dd>{{ formatCurrency(form.freightFee ?? 0) }}</dd></div>
            <div class="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold"><dt>Total a receber</dt><dd>{{ formatCurrency(total) }}</dd></div>
          </dl>
        </section>
        <section v-if="!isPickupForm" class="card" aria-labelledby="sec-freight">
          <div class="card-header">
            <h2 id="sec-freight" class="card-title">Viabilidade do frete</h2>
            <span class="text-xs text-slate-400">estimativa</span>
          </div>
          <div class="p-4">
            <FreightBreakdown :result="estimate" compact />
          </div>
        </section>
        <div class="flex flex-col gap-2">
          <AppButton type="submit" variant="primary" block :loading="saving">{{ editing ? 'Salvar alterações' : 'Cadastrar pedido' }}</AppButton>
          <AppButton v-if="!editing" block :disabled="saving" @click="submit(true)">Cadastrar e iniciar outro</AppButton>
          <AppButton variant="ghost" block :to="editing ? { name: 'order-detail', params: { id: editing.order.id } } : { name: 'orders' }">Cancelar</AppButton>
        </div>
      </aside>
    </div>
  </form>
</template>
