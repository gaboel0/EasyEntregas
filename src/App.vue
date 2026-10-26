<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { Bike, CloudOff } from 'lucide-vue-next'
import ToastHost from '@/components/ui/ToastHost.vue'
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
onMounted(() => app.init())
</script>

<template>
  <div v-if="app.status === 'error'" class="grid min-h-screen place-items-center p-6">
    <div class="card max-w-md p-8 text-center">
      <span class="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600" aria-hidden="true"><CloudOff :size="22" /></span>
      <h1 class="mt-4 text-lg font-semibold">Não foi possível carregar o painel</h1>
      <p class="mt-1 text-sm text-slate-500">{{ app.error }}</p>
      <AppButton class="mt-5" variant="primary" @click="app.retry()">Tentar novamente</AppButton>
    </div>
  </div>
  <div v-else-if="app.status !== 'ready'" class="grid min-h-screen place-items-center" role="status" aria-live="polite">
    <div class="flex flex-col items-center gap-3 text-slate-500">
      <span class="grid size-11 animate-pulse place-items-center rounded-xl bg-primary text-white" aria-hidden="true"><Bike :size="22" /></span>
      <p class="text-sm">Carregando a operação…</p>
    </div>
  </div>
  <RouterView v-else />
  <ToastHost />
  <ConfirmDialogHost />
</template>
