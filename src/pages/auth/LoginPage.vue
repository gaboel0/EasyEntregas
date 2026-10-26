<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { FlaskConical, TriangleAlert } from 'lucide-vue-next'
import RoleSwitch from '@/components/auth/RoleSwitch.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import FormField from '@/components/ui/FormField.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useAuthRole } from '@/composables/useAuthRole'
import { useZodForm } from '@/composables/useZodForm'
import { signInSchema } from '@/modules/auth/authSchema'
import { dataSource, errorMessage } from '@/services'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { role, roleQuery } = useAuthRole()
const { error, validate, revalidate, focusFirstError } = useZodForm(signInSchema)

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const failure = ref<string | null>(null)
const isDemo = !!dataSource.demo

async function submit() {
  failure.value = null
  const data = validate(form)
  if (!data) return focusFirstError()
  loading.value = true
  try {
    const session = await auth.signIn({ role: role.value, ...data })
    // O destino vem da sessão devolvida pelo serviço, não da aba escolhida.
    if (session.role === 'courier') return await router.replace({ name: 'courier-soon' })
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//') ? route.query.redirect : null
    await router.replace(redirect ?? { name: 'dashboard' })
  } catch (e) {
    failure.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function useDemoAccount() {
  role.value = 'establishment'
  form.email = 'paulo@bellanapoli.example'
  form.password = 'demonstracao'
  failure.value = null
  revalidate(form)
  await submit()
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h1 class="text-xl font-semibold tracking-tight text-slate-900">Entrar</h1>
    <p class="mt-1 text-sm text-slate-500">
      {{ role === 'establishment' ? 'Acesse o painel de pedidos e entregas do seu estabelecimento.' : 'Acesse sua conta de entregador.' }}
    </p>

    <RoleSwitch v-model="role" class="mt-5" />

    <form novalidate class="mt-5 space-y-4" @submit.prevent="submit">
      <p v-if="failure" class="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">
        <TriangleAlert :size="16" class="mt-0.5 shrink-0" aria-hidden="true" /> {{ failure }}
      </p>
      <FormField v-slot="{ id, invalid, describedby }" label="E-mail" :error="error('email')">
        <input
          :id="id"
          v-model="form.email"
          type="email"
          class="field-input"
          autocomplete="username"
          inputmode="email"
          autofocus
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedby"
          @input="revalidate(form)"
        />
      </FormField>
      <FormField v-slot="{ id, invalid, describedby }" label="Senha" :error="error('password')">
        <PasswordInput :id="id" v-model="form.password" autocomplete="current-password" :invalid="invalid" :describedby="describedby" @update:model-value="revalidate(form)" />
      </FormField>
      <div class="flex justify-end">
        <RouterLink :to="{ name: 'forgot-password', query: roleQuery }" class="text-sm font-medium text-brand-600 hover:text-brand-700">Esqueci minha senha</RouterLink>
      </div>
      <AppButton type="submit" variant="primary" block :loading="loading">
        {{ role === 'establishment' ? 'Entrar no painel' : 'Entrar como entregador' }}
      </AppButton>
    </form>

    <p class="mt-5 text-center text-sm text-slate-500">
      Ainda não tem conta?
      <RouterLink :to="{ name: 'sign-up', query: roleQuery }" class="font-medium text-brand-600 hover:text-brand-700">Cadastre-se</RouterLink>
    </p>

    <div v-if="isDemo" class="mt-6 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
      <p class="flex items-center gap-1.5 font-medium"><FlaskConical :size="13" aria-hidden="true" /> Modo demonstração</p>
      <p class="mt-1">
        A senha não é verificada: o acesso é só para testar a interface. O login real será feito pelo backend.
      </p>
      <button type="button" class="mt-1.5 font-medium underline underline-offset-2" @click="useDemoAccount">Entrar com a conta de exemplo (Pizzaria Bella Napoli)</button>
    </div>
  </div>
</template>
