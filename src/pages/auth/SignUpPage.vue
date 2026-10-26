<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { TriangleAlert } from 'lucide-vue-next'
import RoleSwitch from '@/components/auth/RoleSwitch.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import FormField from '@/components/ui/FormField.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useAuthRole } from '@/composables/useAuthRole'
import { useZodForm } from '@/composables/useZodForm'
import { BUSINESS_TYPE_LABEL, BUSINESS_TYPES, courierSignUpSchema, establishmentSignUpSchema } from '@/modules/auth/authSchema'
import { errorMessage } from '@/services'
import { formatPhone } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()
const { role, roleQuery } = useAuthRole()

const establishmentForm = useZodForm(establishmentSignUpSchema)
const courierForm = useZodForm(courierSignUpSchema)
const active = computed(() => (role.value === 'establishment' ? establishmentForm : courierForm))

const form = reactive({
  ownerName: '',
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  businessName: '',
  businessType: '' as string,
  phone: '',
})
const loading = ref(false)
const failure = ref<string | null>(null)

const payload = () =>
  role.value === 'establishment'
    ? { ownerName: form.ownerName, email: form.email, password: form.password, confirmPassword: form.confirmPassword, businessName: form.businessName, businessType: form.businessType, phone: form.phone }
    : { fullName: form.fullName, email: form.email, password: form.password, confirmPassword: form.confirmPassword, phone: form.phone }

watch(form, () => active.value.revalidate(payload()), { deep: true })
watch(role, () => {
  failure.value = null
  establishmentForm.reset()
  courierForm.reset()
})

const error = (path: string) => active.value.error(path)

async function submit() {
  failure.value = null
  const data = active.value.validate(payload())
  if (!data) return active.value.focusFirstError()
  loading.value = true
  try {
    // A confirmação existe só para validar a digitação; o serviço recebe apenas a senha.
    if (role.value === 'establishment') {
      const d = establishmentSignUpSchema.parse(payload())
      await auth.signUp({ role: 'establishment', ownerName: d.ownerName, email: d.email, password: d.password, businessName: d.businessName, businessType: d.businessType, phone: d.phone })
      await router.replace({ name: 'dashboard' })
    } else {
      const d = courierSignUpSchema.parse(payload())
      await auth.signUp({ role: 'courier', fullName: d.fullName, email: d.email, password: d.password, phone: d.phone })
      await router.replace({ name: 'courier-soon' })
    }
  } catch (e) {
    failure.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h1 class="text-xl font-semibold tracking-tight text-slate-900">Criar conta</h1>
    <p class="mt-1 text-sm text-slate-500">
      {{ role === 'establishment' ? 'Cadastre seu estabelecimento e comece a organizar suas entregas.' : 'Cadastre-se para receber entregas de estabelecimentos parceiros.' }}
    </p>

    <RoleSwitch v-model="role" class="mt-5" />

    <form novalidate class="mt-5 grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
      <p v-if="failure" class="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2" role="alert">
        <TriangleAlert :size="16" class="mt-0.5 shrink-0" aria-hidden="true" /> {{ failure }}
      </p>

      <template v-if="role === 'establishment'">
        <FormField v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Nome do responsável" :error="error('ownerName')">
          <input :id="id" v-model="form.ownerName" class="field-input" autocomplete="name" autofocus :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
        </FormField>
      </template>
      <FormField v-else v-slot="{ id, invalid, describedby }" class="sm:col-span-2" label="Nome completo" :error="error('fullName')">
        <input :id="id" v-model="form.fullName" class="field-input" autocomplete="name" autofocus :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
      </FormField>

      <FormField v-slot="{ id, invalid, describedby }" label="E-mail" :error="error('email')">
        <input :id="id" v-model="form.email" type="email" class="field-input" autocomplete="email" inputmode="email" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
      </FormField>
      <FormField v-slot="{ id, invalid, describedby }" label="Telefone" :error="error('phone')">
        <input
          :id="id"
          v-model="form.phone"
          type="tel"
          class="field-input tabular"
          autocomplete="tel"
          placeholder="(11) 99999-0000"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedby"
          @blur="form.phone = formatPhone(form.phone)"
        />
      </FormField>

      <template v-if="role === 'establishment'">
        <FormField v-slot="{ id, invalid, describedby }" label="Nome do estabelecimento" :error="error('businessName')">
          <input :id="id" v-model="form.businessName" class="field-input" autocomplete="organization" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
        </FormField>
        <FormField v-slot="{ id, invalid, describedby }" label="Tipo de negócio" :error="error('businessType')">
          <select :id="id" v-model="form.businessType" class="field-input" :aria-invalid="invalid || undefined" :aria-describedby="describedby">
            <option value="" disabled>Selecione…</option>
            <option v-for="t in BUSINESS_TYPES" :key="t" :value="t">{{ BUSINESS_TYPE_LABEL[t] }}</option>
          </select>
        </FormField>
      </template>

      <FormField v-slot="{ id, invalid, describedby }" label="Senha" :error="error('password')" hint="Mínimo de 8 caracteres">
        <PasswordInput :id="id" v-model="form.password" autocomplete="new-password" :invalid="invalid" :describedby="describedby" />
      </FormField>
      <FormField v-slot="{ id, invalid, describedby }" label="Confirmar senha" :error="error('confirmPassword')">
        <PasswordInput :id="id" v-model="form.confirmPassword" autocomplete="new-password" :invalid="invalid" :describedby="describedby" />
      </FormField>

      <AppButton type="submit" variant="primary" block class="sm:col-span-2" :loading="loading">
        {{ role === 'establishment' ? 'Criar conta do estabelecimento' : 'Criar conta de entregador' }}
      </AppButton>
    </form>

    <p class="mt-5 text-center text-sm text-slate-500">
      Já tem conta?
      <RouterLink :to="{ name: 'login', query: roleQuery }" class="font-medium text-brand-600 hover:text-brand-700">Entrar</RouterLink>
    </p>
  </div>
</template>
