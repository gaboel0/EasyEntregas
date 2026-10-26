<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, Building2, Database, Palette, Plug, SlidersHorizontal, Users } from 'lucide-vue-next'
import AppearanceSettings from '@/components/settings/AppearanceSettings.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EstablishmentSettings from '@/components/settings/EstablishmentSettings.vue'
import OperationSettings from '@/components/settings/OperationSettings.vue'
import UsersSettings from '@/components/settings/UsersSettings.vue'
import IntegrationsSettings from '@/components/settings/IntegrationsSettings.vue'
import DataSettings from '@/components/settings/DataSettings.vue'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const TABS = [
  { key: 'estabelecimento', label: 'Estabelecimento', icon: Building2 },
  { key: 'operacao', label: 'Operação e custos', icon: SlidersHorizontal },
  { key: 'notificacoes', label: 'Notificações', icon: Bell },
  { key: 'aparencia', label: 'Aparência', icon: Palette },
  { key: 'usuarios', label: 'Usuários e permissões', icon: Users },
  { key: 'integracoes', label: 'Integrações', icon: Plug },
  { key: 'dados', label: 'Dados', icon: Database },
] as const
type TabKey = (typeof TABS)[number]['key']

const tab = computed<TabKey>({
  get: () => (TABS.some((t) => t.key === route.query.tab) ? (route.query.tab as TabKey) : 'estabelecimento'),
  set: (v) => router.replace({ query: { tab: v } }),
})

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
  const next = TABS[(index + delta + TABS.length) % TABS.length]!
  tab.value = next.key
  document.getElementById(`tab-${next.key}`)?.focus()
}
</script>

<template>
  <div>
    <PageHeader title="Configurações" description="Dados do estabelecimento, parâmetros de custo, notificações e acessos." />
    <p v-if="!session.can('settings.manage')" class="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
      Seu perfil pode visualizar, mas não alterar, as configurações.
    </p>
    <div class="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav role="tablist" aria-label="Seções de configuração" aria-orientation="vertical" class="flex gap-1 overflow-x-auto lg:flex-col">
        <button
          v-for="(t, index) in TABS"
          :id="`tab-${t.key}`"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="tab === t.key"
          :aria-controls="`panel-${t.key}`"
          :tabindex="tab === t.key ? 0 : -1"
          class="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors"
          :class="tab === t.key ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900'"
          @click="tab = t.key"
          @keydown="onKeydown($event, index)"
        >
          <component :is="t.icon" :size="16" aria-hidden="true" /> {{ t.label }}
        </button>
      </nav>
      <div :id="`panel-${tab}`" role="tabpanel" :aria-labelledby="`tab-${tab}`" class="min-w-0">
        <EstablishmentSettings v-if="tab === 'estabelecimento'" />
        <OperationSettings v-else-if="tab === 'operacao'" key="operation" section="operation" />
        <OperationSettings v-else-if="tab === 'notificacoes'" key="notifications" section="notifications" />
        <AppearanceSettings v-else-if="tab === 'aparencia'" />
        <UsersSettings v-else-if="tab === 'usuarios'" />
        <IntegrationsSettings v-else-if="tab === 'integracoes'" />
        <DataSettings v-else />
      </div>
    </div>
  </div>
</template>
