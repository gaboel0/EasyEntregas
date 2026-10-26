<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { CompensationModel, CourierLinkType, CourierProfile, VehicleType } from '@/types/domain'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/ui/FormField.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { useCouriersStore } from '@/stores/couriers'
import { useSettingsStore } from '@/stores/settings'
import { useZodForm } from '@/composables/useZodForm'
import { useToast } from '@/composables/useToast'
import { courierInputSchema } from '@/modules/couriers/courierSchema'
import { COMPENSATION_MODEL_LABEL, LINK_TYPE_LABEL, VEHICLE_TYPE_LABEL } from '@/modules/couriers/courierLabels'
import { formatPhone } from '@/utils/format'
import { errorMessage } from '@/services'

const props = defineProps<{ open: boolean; courier: CourierProfile | null }>()
const emit = defineEmits<{ close: []; saved: [profile: CourierProfile] }>()

const couriers = useCouriersStore()
const settings = useSettingsStore()
const toast = useToast()
const { error, validate, revalidate, reset, focusFirstError } = useZodForm(courierInputSchema)

interface CourierFormState {
  name: string
  phone: string
  internalCode: string
  linkType: CourierLinkType
  compensation: { model: CompensationModel; perDelivery: number | null; perKm: number | null }
  vehicleCostsPaidByEstablishment: boolean
  shiftStatus: 'available' | 'unavailable'
  notes: string
  vehicle: { type: VehicleType; model: string; plate: string; consumptionKmPerLiter: number | null }
}

const form = reactive<CourierFormState>(blank())
const saving = ref(false)
const costsTouched = ref(false)

function nextCode() {
  const used = new Set(couriers.couriers.map((c) => c.link.internalCode.toUpperCase()))
  for (let i = couriers.couriers.length + 1; ; i++) {
    const code = `MB-${String(i).padStart(2, '0')}`
    if (!used.has(code)) return code
  }
}

function blank(): CourierFormState {
  const comp = settings.settings?.defaultCompensation ?? { model: 'per_delivery', perDelivery: 6, perKm: 0 }
  return {
    name: '',
    phone: '',
    internalCode: '',
    linkType: 'partner',
    compensation: { ...comp },
    vehicleCostsPaidByEstablishment: false,
    shiftStatus: 'available',
    notes: '',
    vehicle: { type: 'motorcycle', model: '', plate: '', consumptionKmPerLiter: settings.settings?.defaultConsumptionKmPerLiter ?? 35 },
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    reset()
    costsTouched.value = !!props.courier
    const c = props.courier
    Object.assign(
      form,
      c
        ? {
            name: c.name,
            phone: c.phone,
            internalCode: c.link.internalCode,
            linkType: c.link.linkType,
            compensation: { ...c.link.compensation },
            vehicleCostsPaidByEstablishment: c.link.vehicleCostsPaidByEstablishment,
            shiftStatus: c.link.shiftStatus,
            notes: c.link.notes ?? '',
            vehicle: { type: c.vehicle.type, model: c.vehicle.model ?? '', plate: c.vehicle.plate ?? '', consumptionKmPerLiter: c.vehicle.consumptionKmPerLiter },
          }
        : { ...blank(), internalCode: nextCode() },
    )
  },
)

// Funcionário costuma usar veículo/combustível da empresa; parceiro, o próprio.
watch(
  () => form.linkType,
  (type) => {
    if (!costsTouched.value) form.vehicleCostsPaidByEstablishment = type === 'employee'
  },
)

const usesPerDelivery = computed(() => form.compensation.model === 'per_delivery' || form.compensation.model === 'per_delivery_plus_km')
const usesPerKm = computed(() => form.compensation.model === 'per_km' || form.compensation.model === 'per_delivery_plus_km')

function payload() {
  return {
    ...form,
    compensation: {
      model: form.compensation.model,
      perDelivery: usesPerDelivery.value ? form.compensation.perDelivery : 0,
      perKm: usesPerKm.value ? form.compensation.perKm : 0,
    },
    notes: form.notes || undefined,
    vehicle: {
      ...form.vehicle,
      model: form.vehicle.model || undefined,
      plate: form.vehicle.plate.toUpperCase() || undefined,
      consumptionKmPerLiter: form.vehicle.type === 'bicycle' ? null : form.vehicle.consumptionKmPerLiter,
    },
  }
}

watch(form, () => revalidate(payload()), { deep: true })

async function submit() {
  const data = validate(payload())
  if (!data) {
    focusFirstError()
    return
  }
  saving.value = true
  try {
    const saved = props.courier ? await couriers.update(props.courier.id, data) : await couriers.create(data)
    toast.success(props.courier ? 'Dados do motoboy atualizados' : 'Motoboy cadastrado', saved.name)
    emit('saved', saved)
    emit('close')
  } catch (e) {
    toast.error('Não foi possível salvar', errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :open="open" size="lg" persistent :title="courier ? `Editar ${courier.name}` : 'Cadastrar motoboy'" description="Dados do entregador e do vínculo com este estabelecimento." @close="emit('close')">
    <form id="courier-form" novalidate class="space-y-5" @submit.prevent="submit">
      <fieldset class="grid gap-4 sm:grid-cols-6">
        <legend class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:col-span-6">Identificação</legend>
        <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-4" label="Nome completo" required :error="error('name')">
          <input :id="id" v-model="form.name" class="field-input" maxlength="120" autofocus :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
        </FormField>
        <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Identificador interno" required :error="error('internalCode')">
          <input :id="id" v-model="form.internalCode" class="field-input uppercase" maxlength="20" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
        </FormField>
        <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Telefone" required :error="error('phone')">
          <input :id="id" v-model="form.phone" class="field-input tabular" inputmode="tel" maxlength="20" placeholder="(11) 99999-0000" :aria-invalid="invalid || undefined" :aria-describedby="describedby" @blur="form.phone = formatPhone(form.phone)" />
        </FormField>
        <FormField v-slot="{ id }" class="sm:col-span-2" label="Tipo de vínculo" required>
          <select :id="id" v-model="form.linkType" class="field-input">
            <option v-for="(label, key) in LINK_TYPE_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <FormField v-slot="{ id }" class="sm:col-span-2" label="Disponibilidade" hint="“Ocupado” é automático quando há entregas em rota.">
          <select :id="id" v-model="form.shiftStatus" class="field-input">
            <option value="available">Disponível (em turno)</option>
            <option value="unavailable">Indisponível</option>
          </select>
        </FormField>
      </fieldset>

      <fieldset class="grid gap-4 sm:grid-cols-6">
        <legend class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:col-span-6">Remuneração</legend>
        <FormField v-slot="{ id }" class="sm:col-span-2" label="Forma de remuneração" required>
          <select :id="id" v-model="form.compensation.model" class="field-input">
            <option v-for="(label, key) in COMPENSATION_MODEL_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <FormField v-if="usesPerDelivery" v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Valor fixo por entrega" required :error="error('compensation.perDelivery')">
          <NumberInput :id="id" v-model="form.compensation.perDelivery" prefix="R$" :invalid="invalid" :describedby="describedby" />
        </FormField>
        <FormField v-if="usesPerKm" v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Valor por km rodado" required :error="error('compensation.perKm')">
          <NumberInput :id="id" v-model="form.compensation.perKm" prefix="R$" :invalid="invalid" :describedby="describedby" />
        </FormField>
        <p v-if="form.compensation.model === 'fixed_salary'" class="text-xs text-slate-500 sm:col-span-4 sm:pt-6">O salário não entra no custo por entrega. Combustível e desgaste continuam sendo considerados se forem pagos pelo estabelecimento.</p>
      </fieldset>

      <fieldset class="grid gap-4 sm:grid-cols-6">
        <legend class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:col-span-6">Veículo</legend>
        <FormField v-slot="{ id }" class="sm:col-span-2" label="Tipo">
          <select :id="id" v-model="form.vehicle.type" class="field-input">
            <option v-for="(label, key) in VEHICLE_TYPE_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </FormField>
        <template v-if="form.vehicle.type !== 'bicycle'">
          <FormField v-slot="{ id }" class="sm:col-span-2" label="Modelo">
            <input :id="id" v-model="form.vehicle.model" class="field-input" maxlength="60" placeholder="Ex.: Honda CG 160" />
          </FormField>
          <FormField v-slot="{ id }" label="Placa">
            <input :id="id" v-model="form.vehicle.plate" class="field-input uppercase" maxlength="10" />
          </FormField>
          <FormField v-slot="{ id, invalid, describedby }" label="Consumo" :error="error('vehicle.consumptionKmPerLiter')">
            <NumberInput :id="id" v-model="form.vehicle.consumptionKmPerLiter" suffix="km/l" :decimals="1" :invalid="invalid" :describedby="describedby" />
          </FormField>
        </template>
        <div class="sm:col-span-6">
          <AppSwitch
            v-model="form.vehicleCostsPaidByEstablishment"
            label="Combustível e custos do veículo pagos pelo estabelecimento"
            description="Ative para motos da empresa. Para parceiros que usam o próprio veículo, deixe desativado para não contar o combustível duas vezes."
            @update:model-value="costsTouched = true"
          />
        </div>
      </fieldset>

      <FormField v-slot="{ id, invalid }" label="Observações" :error="error('notes')">
        <textarea :id="id" v-model="form.notes" rows="2" class="field-input resize-y" maxlength="500" :aria-invalid="invalid || undefined" />
      </FormField>
    </form>
    <template #footer>
      <AppButton @click="emit('close')">Cancelar</AppButton>
      <AppButton type="submit" form="courier-form" variant="primary" :loading="saving">{{ courier ? 'Salvar alterações' : 'Cadastrar motoboy' }}</AppButton>
    </template>
  </AppModal>
</template>
