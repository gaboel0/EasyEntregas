<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Check, ChevronDown, Moon, Settings, Sun } from 'lucide-vue-next'
import { useAppearance } from '@/composables/useAppearance'
import AppPopover from '@/components/ui/AppPopover.vue'
import { useSessionStore } from '@/stores/session'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { ROLE_LABEL } from '@/modules/settings/permissions'
import { initials } from '@/utils/text'
import { errorMessage } from '@/services'

const session = useSessionStore()
const app = useAppStore()
const toast = useToast()
const switching = ref(false)
const { isDark, toggleTheme } = useAppearance()

async function switchTo(establishmentId: string, userId: string, close: () => void) {
  if (switching.value) return
  switching.value = true
  try {
    await app.switchSession(establishmentId, userId)
    close()
    toast.info('Sessão de demonstração alterada', `${session.user?.name} · ${session.establishment?.name}`)
  } catch (e) {
    toast.error('Não foi possível trocar a sessão', errorMessage(e))
  } finally {
    switching.value = false
  }
}
</script>

<template>
  <AppPopover width="w-80">
    <template #trigger="{ toggle, open }">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-slate-100"
        :aria-expanded="open"
        aria-label="Menu do usuário"
        @click="toggle"
      >
        <span class="grid size-7 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700" aria-hidden="true">
          {{ initials(session.user?.name ?? '') }}
        </span>
        <span class="hidden text-left md:block">
          <span class="block max-w-36 truncate text-sm leading-tight font-medium text-slate-900">{{ session.user?.name }}</span>
          <span class="block text-[11px] leading-tight text-slate-500">{{ session.user ? ROLE_LABEL[session.user.role] : '' }}</span>
        </span>
        <ChevronDown :size="14" class="hidden text-slate-400 md:block" aria-hidden="true" />
      </button>
    </template>
    <template #default="{ close }">
      <div class="border-b border-slate-100 px-4 py-3">
        <p class="text-sm font-semibold text-slate-900">{{ session.user?.name }}</p>
        <p class="text-xs text-slate-500">{{ session.user?.email }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ session.establishment?.name }}</p>
      </div>
      <RouterLink :to="{ name: 'settings' }" class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100/70" @click="close()">
        <Settings :size="15" aria-hidden="true" /> Configurações
      </RouterLink>
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100/70"
        :aria-label="isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" :size="15" aria-hidden="true" />
        <Moon v-else :size="15" aria-hidden="true" />
        {{ isDark ? 'Tema claro' : 'Tema escuro' }}
      </button>
      <div v-if="session.isDemo" class="border-t border-slate-100 px-2 py-2">
        <p class="px-2 pb-1 text-[11px] font-medium tracking-wide text-slate-500 uppercase">Simular sessão (demonstração)</p>
        <p class="px-2 pb-2 text-[11px] text-slate-500">Troque de estabelecimento ou perfil para ver o isolamento de dados e as permissões.</p>
        <div v-for="est in session.demoOptions" :key="est.id" class="mb-1">
          <p class="px-2 py-1 text-xs font-semibold text-slate-700">{{ est.name }}</p>
          <button
            v-for="u in est.users"
            :key="u.id"
            type="button"
            class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100/70 disabled:opacity-50"
            :disabled="switching"
            @click="switchTo(est.id, u.id, close)"
          >
            <span>{{ u.name }} · {{ ROLE_LABEL[u.role] }}</span>
            <Check v-if="session.user?.id === u.id" :size="14" class="text-brand-600" aria-label="sessão atual" />
          </button>
        </div>
      </div>
    </template>
  </AppPopover>
</template>
