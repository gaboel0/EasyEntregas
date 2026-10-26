<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { CloudOff } from 'lucide-vue-next'
import ToastHost from '@/components/ui/ToastHost.vue'
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const route = useRoute()
/** Telas de acesso não dependem dos dados do estabelecimento. */
const isPublic = computed(() => !!route.meta.public)

watchEffect(() => {
  if (route.name && !isPublic.value) app.init()
})
</script>

<template>
  <div v-if="!isPublic && app.status === 'error'" class="grid min-h-screen place-items-center p-6">
    <div class="card max-w-md p-8 text-center">
      <span class="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600" aria-hidden="true"><CloudOff :size="22" /></span>
      <h1 class="mt-4 text-lg font-semibold">Não foi possível carregar o painel</h1>
      <p class="mt-1 text-sm text-slate-500">{{ app.error }}</p>
      <AppButton class="mt-5" variant="primary" @click="app.retry()">Tentar novamente</AppButton>
    </div>
  </div>
  <RouterView v-else />
  <ToastHost />
  <ConfirmDialogHost />
</template>
