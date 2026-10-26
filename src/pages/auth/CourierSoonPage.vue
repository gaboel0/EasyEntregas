<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Smartphone } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function leave() {
  await auth.signOut()
  await router.replace({ name: 'login', query: { perfil: 'entregador' } })
}
</script>

<template>
  <div class="card p-6 text-center sm:p-8">
    <span class="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true"><Smartphone :size="22" /></span>
    <h1 class="mt-4 text-xl font-semibold tracking-tight text-slate-900">Área do entregador em breve</h1>
    <p class="mt-2 text-sm text-slate-500">
      O aplicativo do entregador ainda não está disponível, então não há o que acessar por aqui. Nesta versão, nenhum dado de entregador foi salvo.
    </p>
    <AppButton class="mt-6" block @click="leave">Voltar para o login</AppButton>
  </div>
</template>
