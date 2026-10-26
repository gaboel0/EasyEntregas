<script setup lang="ts">
import { ref } from 'vue'
import { Database, RotateCcw } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { useAppStore } from '@/stores/app'
import { useSessionStore } from '@/stores/session'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/services'

const app = useAppStore()
const session = useSessionStore()
const { confirm } = useConfirm()
const toast = useToast()
const resetting = ref(false)

async function reset() {
  const { confirmed } = await confirm({
    title: 'Restaurar dados de demonstração?',
    description: 'Todos os pedidos, motoboys e configurações salvos neste navegador serão substituídos por um novo conjunto de dados demonstrativos, com pedidos de hoje em andamento.',
    confirmLabel: 'Restaurar dados',
    tone: 'danger',
  })
  if (!confirmed) return
  resetting.value = true
  try {
    await app.resetDemoData()
    toast.success('Dados de demonstração restaurados')
  } catch (e) {
    toast.error('Não foi possível restaurar', errorMessage(e))
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <section class="card">
    <div class="card-header"><h2 class="card-title">Dados e armazenamento</h2></div>
    <div class="space-y-4 p-4 text-sm text-slate-600">
      <div class="flex gap-3">
        <Database :size="18" class="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
        <div>
          <p v-if="session.isDemo">
            Este painel está em <strong>modo demonstração</strong>: os dados são fictícios e ficam salvos somente neste navegador (localStorage). Alterações aparecem em todas as telas e
            continuam disponíveis após recarregar a página.
          </p>
          <p v-else>Os dados são carregados da API configurada.</p>
          <p class="mt-2 text-xs text-slate-500">
            O armazenamento local não é seguro nem compartilhado: não serve para autenticação, isolamento entre empresas ou uso em produção. Em produção, os dados ficam no backend.
          </p>
        </div>
      </div>
      <div v-if="session.isDemo" class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-3">
        <div>
          <p class="font-medium text-slate-900">Restaurar dados de demonstração</p>
          <p class="text-xs text-slate-500">Útil para reiniciar os testes com pedidos de hoje em diferentes etapas.</p>
        </div>
        <AppButton :icon="RotateCcw" :loading="resetting" @click="reset">Restaurar</AppButton>
      </div>
    </div>
  </section>
</template>
