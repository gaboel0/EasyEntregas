<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, MailCheck, TriangleAlert } from 'lucide-vue-next'
import FormField from '@/components/ui/FormField.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useAuthRole } from '@/composables/useAuthRole'
import { useZodForm } from '@/composables/useZodForm'
import { forgotPasswordSchema } from '@/modules/auth/authSchema'
import { dataSource, errorMessage } from '@/services'

const auth = useAuthStore()
const { roleQuery } = useAuthRole()
const { error, validate, revalidate, focusFirstError } = useZodForm(forgotPasswordSchema)

const form = reactive({ email: '' })
const loading = ref(false)
const sent = ref(false)
const failure = ref<string | null>(null)
const isDemo = !!dataSource.demo

async function submit() {
  failure.value = null
  const data = validate(form)
  if (!data) return focusFirstError()
  loading.value = true
  try {
    await auth.requestPasswordReset(data.email)
    sent.value = true
  } catch (e) {
    failure.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <template v-if="!sent">
      <h1 class="text-xl font-semibold tracking-tight text-slate-900">Recuperar senha</h1>
      <p class="mt-1 text-sm text-slate-500">Informe o e-mail da conta. Se ela existir, enviaremos as instruções para criar uma nova senha.</p>
      <form novalidate class="mt-5 space-y-4" @submit.prevent="submit">
        <p v-if="failure" class="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          <TriangleAlert :size="16" class="mt-0.5 shrink-0" aria-hidden="true" /> {{ failure }}
        </p>
        <FormField v-slot="{ id, invalid, describedby }" label="E-mail" :error="error('email')">
          <input :id="id" v-model="form.email" type="email" class="field-input" autocomplete="email" autofocus :aria-invalid="invalid || undefined" :aria-describedby="describedby" @input="revalidate(form)" />
        </FormField>
        <AppButton type="submit" variant="primary" block :loading="loading">Enviar instruções</AppButton>
      </form>
    </template>
    <div v-else class="text-center" role="status">
      <span class="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden="true"><MailCheck :size="22" /></span>
      <h1 class="mt-4 text-xl font-semibold tracking-tight text-slate-900">Confira seu e-mail</h1>
      <p class="mt-1 text-sm text-slate-500">Se existir uma conta para {{ form.email }}, as instruções chegarão em alguns minutos.</p>
      <p v-if="isDemo" class="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Modo demonstração: nenhum e-mail é enviado de verdade.</p>
    </div>
    <p class="mt-5 text-center text-sm">
      <RouterLink :to="{ name: 'login', query: roleQuery }" class="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft :size="14" aria-hidden="true" /> Voltar para o login
      </RouterLink>
    </p>
  </div>
</template>
