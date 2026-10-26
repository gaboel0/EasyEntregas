<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { GeoPoint } from '@/types/domain'
import FormField from '@/components/ui/FormField.vue'
import AppButton from '@/components/ui/AppButton.vue'
import LocationPicker from '@/components/map/LocationPicker.vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { useZodForm } from '@/composables/useZodForm'
import { useToast } from '@/composables/useToast'
import { establishmentInputSchema } from '@/modules/settings/settingsSchema'
import { formatPhone } from '@/utils/format'
import { errorMessage } from '@/services'

const session = useSessionStore()
const settings = useSettingsStore()
const toast = useToast()
const { error, validate, revalidate, focusFirstError } = useZodForm(establishmentInputSchema)
const canEdit = session.can('settings.manage')

function fromStore() {
  const e = session.establishment!
  return {
    name: e.name,
    legalName: e.legalName ?? '',
    document: e.document ?? '',
    phone: e.phone,
    address: { street: e.address.street, number: e.address.number, district: e.address.district, city: e.address.city, state: e.address.state, zipCode: e.address.zipCode ?? '' },
    location: e.location as GeoPoint | null,
  }
}

const form = reactive(fromStore())
const saving = ref(false)
watch(form, () => revalidate(form), { deep: true })

async function submit() {
  const data = validate(form)
  if (!data) return focusFirstError()
  saving.value = true
  try {
    await settings.updateEstablishment(data)
    toast.success('Dados do estabelecimento salvos')
  } catch (e) {
    toast.error('Não foi possível salvar', errorMessage(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form novalidate class="card" @submit.prevent="submit">
    <div class="card-header"><h2 class="card-title">Dados do estabelecimento</h2></div>
    <fieldset :disabled="!canEdit" class="grid gap-4 p-4 sm:grid-cols-6">
      <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-3" label="Nome fantasia" required :error="error('name')">
        <input :id="id" v-model="form.name" class="field-input" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
      </FormField>
      <FormField v-slot="{ id }" class="sm:col-span-3" label="Razão social">
        <input :id="id" v-model="form.legalName" class="field-input" />
      </FormField>
      <FormField v-slot="{ id }" class="sm:col-span-2" label="CNPJ">
        <input :id="id" v-model="form.document" class="field-input tabular" maxlength="20" />
      </FormField>
      <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Telefone" required :error="error('phone')">
        <input :id="id" v-model="form.phone" class="field-input tabular" :aria-invalid="invalid || undefined" :aria-describedby="describedby" @blur="form.phone = formatPhone(form.phone)" />
      </FormField>
      <FormField v-slot="{ id }" class="sm:col-span-2" label="CEP">
        <input :id="id" v-model="form.address.zipCode" class="field-input tabular" maxlength="9" />
      </FormField>
      <FormField v-slot="{ id, invalid }" class="sm:col-span-4" label="Rua" required :error="error('address.street')">
        <input :id="id" v-model="form.address.street" class="field-input" :aria-invalid="invalid || undefined" />
      </FormField>
      <FormField v-slot="{ id, invalid }" class="sm:col-span-2" label="Número" required :error="error('address.number')">
        <input :id="id" v-model="form.address.number" class="field-input" :aria-invalid="invalid || undefined" />
      </FormField>
      <FormField v-slot="{ id, invalid }" class="sm:col-span-2" label="Bairro" required :error="error('address.district')">
        <input :id="id" v-model="form.address.district" class="field-input" :aria-invalid="invalid || undefined" />
      </FormField>
      <FormField v-slot="{ id, invalid }" class="sm:col-span-3" label="Cidade" required :error="error('address.city')">
        <input :id="id" v-model="form.address.city" class="field-input" :aria-invalid="invalid || undefined" />
      </FormField>
      <FormField v-slot="{ id, invalid }" label="UF" required :error="error('address.state')">
        <input :id="id" v-model="form.address.state" class="field-input uppercase" maxlength="2" :aria-invalid="invalid || undefined" />
      </FormField>
      <div class="sm:col-span-6">
        <p class="mb-1 text-xs font-medium text-slate-700">Localização do estabelecimento</p>
        <LocationPicker v-model="form.location" :origin="null" />
        <p class="mt-1 text-xs text-slate-500">Ponto de partida das entregas: usado para calcular distâncias em linha reta e centralizar o mapa.</p>
      </div>
    </fieldset>
    <div v-if="canEdit" class="flex justify-end border-t border-slate-100 px-4 py-3">
      <AppButton type="submit" variant="primary" :loading="saving">Salvar dados</AppButton>
    </div>
  </form>
</template>
