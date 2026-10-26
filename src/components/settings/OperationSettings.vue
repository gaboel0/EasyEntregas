<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { CompensationModel, NotificationPreferences, RouteMode } from '@/types/domain'
import FormField from '@/components/ui/FormField.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { useZodForm } from '@/composables/useZodForm'
import { useToast } from '@/composables/useToast'
import { operationalSettingsInputSchema } from '@/modules/settings/settingsSchema'
import { COMPENSATION_MODEL_LABEL } from '@/modules/couriers/courierLabels'
import { estimateFreight } from '@/modules/deliveries/freightCalculator'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { errorMessage } from '@/services'

/** Edita custos, regras operacionais, remuneração padrão ou notificações (mesmo registro de configurações). */
const props = defineProps<{ section: 'operation' | 'notifications' }>()

const store = useSettingsStore()
const session = useSessionStore()
const toast = useToast()
const canEdit = session.can('settings.manage')
const { error, validate, revalidate, focusFirstError } = useZodForm(operationalSettingsInputSchema)

interface SettingsForm {
  fuelPricePerLiter: number | null
  defaultConsumptionKmPerLiter: number | null
  variableCostPerKm: number | null
  routeMode: RouteMode
  defaultFreightFee: number | null
  dispatchAlertMinutes: number | null
  maxConcurrentDeliveriesPerCourier: number | null
  breakEvenTolerancePct: number | null
  defaultCompensation: { model: CompensationModel; perDelivery: number | null; perKm: number | null }
  notifications: NotificationPreferences
}

function fromStore(): SettingsForm {
  const s = store.current()
  return {
    fuelPricePerLiter: s.fuelPricePerLiter,
    defaultConsumptionKmPerLiter: s.defaultConsumptionKmPerLiter,
    variableCostPerKm: s.variableCostPerKm,
    routeMode: s.routeMode,
    defaultFreightFee: s.defaultFreightFee,
    dispatchAlertMinutes: s.dispatchAlertMinutes,
    maxConcurrentDeliveriesPerCourier: s.maxConcurrentDeliveriesPerCourier,
    breakEvenTolerancePct: s.breakEvenTolerancePct,
    defaultCompensation: { ...s.defaultCompensation },
    notifications: { ...s.notifications },
  }
}

const form = reactive<SettingsForm>(fromStore())
const saving = ref(false)
watch(form, () => revalidate(form), { deep: true })

const routeOptions = [
  { value: 'round_trip' as RouteMode, label: 'Ida e volta' },
  { value: 'one_way' as RouteMode, label: 'Somente ida' },
]

const preview = computed(() =>
  estimateFreight({
    oneWayDistanceKm: 3,
    routeMode: form.routeMode,
    consumptionKmPerLiter: form.defaultConsumptionKmPerLiter,
    fuelPricePerLiter: form.fuelPricePerLiter ?? 0,
    otherCostsPerKm: form.variableCostPerKm ?? 0,
    compensation: { model: form.defaultCompensation.model, perDelivery: form.defaultCompensation.perDelivery ?? 0, perKm: form.defaultCompensation.perKm ?? 0 },
    includeVehicleCosts: true,
    freightCharged: form.defaultFreightFee ?? 0,
    breakEvenTolerancePct: form.breakEvenTolerancePct ?? 0,
  }),
)

async function submit() {
  const data = validate(form)
  if (!data) return focusFirstError()
  saving.value = true
  try {
    await store.updateSettings(data)
    toast.success(props.section === 'notifications' ? 'Preferências de notificação salvas' : 'Configurações operacionais salvas', 'Indicadores e estimativas foram recalculados.')
  } catch (e) {
    toast.error('Não foi possível salvar', errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form novalidate class="space-y-5" @submit.prevent="submit">
    <template v-if="section === 'operation'">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Custos de referência</h2>
          <span class="text-[11px] text-slate-400">atualizado em {{ formatDateTime(store.current().updatedAt) }}</span>
        </div>
        <fieldset :disabled="!canEdit" class="grid gap-4 p-4 sm:grid-cols-3">
          <FormField v-slot="{ id, invalid, describedby }" label="Preço da gasolina" required :error="error('fuelPricePerLiter')">
            <NumberInput :id="id" v-model="form.fuelPricePerLiter" prefix="R$" suffix="/L" :invalid="invalid" :describedby="describedby" />
          </FormField>
          <FormField v-slot="{ id, invalid, describedby }" label="Consumo médio padrão" required :error="error('defaultConsumptionKmPerLiter')" hint="Usado quando o veículo do motoboy não informa">
            <NumberInput :id="id" v-model="form.defaultConsumptionKmPerLiter" suffix="km/l" :decimals="1" :invalid="invalid" :describedby="describedby" />
          </FormField>
          <FormField v-slot="{ id, invalid, describedby }" label="Outros custos variáveis" required :error="error('variableCostPerKm')" hint="Manutenção, pneus, desgaste">
            <NumberInput :id="id" v-model="form.variableCostPerKm" prefix="R$" suffix="/km" :invalid="invalid" :describedby="describedby" />
          </FormField>
          <div class="sm:col-span-2">
            <p class="mb-1 text-xs font-medium text-slate-700">Percurso considerado nos custos</p>
            <SegmentedControl v-model="form.routeMode" :options="routeOptions" label="Percurso considerado" />
            <p class="mt-1 text-xs text-slate-500">A distância cadastrada nos pedidos é sempre só de ida. Com “ida e volta”, ela é dobrada no cálculo do custo.</p>
          </div>
          <FormField v-slot="{ id, invalid, describedby }" label="Frete padrão" required :error="error('defaultFreightFee')" hint="Sugerido no cadastro de pedidos">
            <NumberInput :id="id" v-model="form.defaultFreightFee" prefix="R$" :invalid="invalid" :describedby="describedby" />
          </FormField>
        </fieldset>
      </section>

      <section class="card">
        <div class="card-header"><h2 class="card-title">Regras operacionais</h2></div>
        <fieldset :disabled="!canEdit" class="grid gap-4 p-4 sm:grid-cols-3">
          <FormField v-slot="{ id, invalid, describedby }" label="Alerta de espera para despacho" required :error="error('dispatchAlertMinutes')" hint="Pedidos prontos há mais tempo são destacados">
            <NumberInput :id="id" v-model="form.dispatchAlertMinutes" suffix="min" :decimals="0" :invalid="invalid" :describedby="describedby" />
          </FormField>
          <FormField v-slot="{ id, invalid, describedby }" label="Entregas simultâneas por motoboy" required :error="error('maxConcurrentDeliveriesPerCourier')" hint="Acima disso o motoboy aparece “no limite”">
            <NumberInput :id="id" v-model="form.maxConcurrentDeliveriesPerCourier" :decimals="0" :invalid="invalid" :describedby="describedby" />
          </FormField>
          <FormField v-slot="{ id, invalid, describedby }" label="Faixa de equilíbrio" required :error="error('breakEvenTolerancePct')" hint="Resultado dentro desta faixa do frete é “próximo do equilíbrio”">
            <NumberInput :id="id" v-model="form.breakEvenTolerancePct" suffix="%" :decimals="0" :invalid="invalid" :describedby="describedby" />
          </FormField>
        </fieldset>
      </section>

      <section class="card">
        <div class="card-header"><h2 class="card-title">Remuneração padrão</h2></div>
        <fieldset :disabled="!canEdit" class="grid gap-4 p-4 sm:grid-cols-3">
          <p class="text-xs text-slate-500 sm:col-span-3">Aplicada em estimativas de pedidos ainda sem motoboy e sugerida no cadastro de novos entregadores. Cada motoboy pode ter regra própria.</p>
          <FormField v-slot="{ id }" label="Forma de remuneração">
            <select :id="id" v-model="form.defaultCompensation.model" class="field-input">
              <option v-for="(label, key) in COMPENSATION_MODEL_LABEL" :key="key" :value="key">{{ label }}</option>
            </select>
          </FormField>
          <FormField v-slot="{ id, invalid, describedby }" label="Valor por entrega" :error="error('defaultCompensation.perDelivery')">
            <NumberInput :id="id" v-model="form.defaultCompensation.perDelivery" prefix="R$" :invalid="invalid" :describedby="describedby" />
          </FormField>
          <FormField v-slot="{ id, invalid, describedby }" label="Valor por km" :error="error('defaultCompensation.perKm')">
            <NumberInput :id="id" v-model="form.defaultCompensation.perKm" prefix="R$" :invalid="invalid" :describedby="describedby" />
          </FormField>
        </fieldset>
        <p class="tabular border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
          Referência com estes valores: entrega de 3 km (ida) custa
          <strong>{{ formatCurrency(preview.operationalCost) }}</strong> e, com o frete padrão, gera
          <strong :class="preview.result < 0 ? 'text-rose-700' : 'text-emerald-700'">{{ formatCurrency(preview.result) }}</strong>.
        </p>
      </section>
    </template>

    <section v-else class="card">
      <div class="card-header"><h2 class="card-title">Alertas da operação</h2></div>
      <fieldset :disabled="!canEdit" class="space-y-4 p-4">
        <AppSwitch v-model="form.notifications.newOrder" label="Novos pedidos" description="Avisa sobre pedidos registrados nos últimos 15 minutos que ainda não entraram em preparo." />
        <AppSwitch v-model="form.notifications.longDispatchWait" label="Espera longa para despacho" description="Avisa quando um pedido pronto ultrapassa o tempo limite configurado." />
        <AppSwitch v-model="form.notifications.deliveryFailed" label="Falhas na entrega" description="Avisa quando uma entrega é registrada como falha." />
        <AppSwitch v-model="form.notifications.playSound" label="Aviso sonoro" description="Toca um som curto neste navegador quando surge um alerta novo." />
        <p class="text-xs text-slate-500">Notificações por WhatsApp, e-mail ou push dependerão do backend e das integrações correspondentes.</p>
      </fieldset>
    </section>

    <div v-if="canEdit" class="flex justify-end">
      <AppButton type="submit" variant="primary" :loading="saving">Salvar configurações</AppButton>
    </div>
  </form>
</template>
