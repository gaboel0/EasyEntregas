<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { FlaskConical, Lock, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-vue-next'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import GlobalSearch from '@/components/layout/GlobalSearch.vue'
import NotificationsMenu from '@/components/layout/NotificationsMenu.vue'
import { useSidebar } from '@/composables/useSidebar'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
import ProfileMenu from '@/components/layout/ProfileMenu.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageSkeleton from '@/components/skeleton/PageSkeleton.vue'
import { useAppStore } from '@/stores/app'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const app = useAppStore()
const { collapsed, expanded, toggle: toggleSidebar, closeDrawer } = useSidebar()

const forbidden = computed(() => {
  const permission = route.meta.permission
  return !!permission && !session.can(permission)
})

watch(
  () => route.fullPath,
  closeDrawer,
)

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key.toLowerCase() === 'n' && session.can('orders.create') && route.name !== 'order-new') {
    event.preventDefault()
    router.push({ name: 'order-new' })
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-shell min-h-screen" :data-sidebar="collapsed ? 'rail' : 'open'">
    <a href="#conteudo" class="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Pular para o conteúdo</a>
    <AppSidebar />

    <div class="app-content flex min-h-screen min-w-0 flex-col">
      <header class="relative z-30">
        <div class="flex h-14 items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            :aria-label="expanded ? 'Recolher barra lateral' : 'Expandir barra lateral'"
            :aria-expanded="expanded"
            aria-controls="sidebar"
            title="Abrir/fechar barra lateral"
            @click="toggleSidebar"
          >
            <PanelLeftOpen v-if="collapsed" :size="19" class="hidden md:block" aria-hidden="true" />
            <PanelLeftClose v-else :size="19" class="hidden md:block" aria-hidden="true" />
            <PanelLeftOpen :size="19" class="md:hidden" aria-hidden="true" />
          </button>
          <GlobalSearch />
          <div class="ml-auto flex items-center gap-1.5">
            <span
              v-if="session.isDemo"
              class="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 xl:inline-flex"
              title="Os dados exibidos são fictícios e ficam salvos apenas neste navegador."
            >
              <FlaskConical :size="12" aria-hidden="true" /> Dados demonstrativos
            </span>
            <AppButton v-if="session.can('orders.create')" size="sm" :icon="Plus" :to="{ name: 'order-new' }" title="Cadastrar pedido manualmente (atalho: N)">
              <span class="hidden sm:inline">Pedido manual</span>
            </AppButton>
            <ThemeToggle />
            <NotificationsMenu />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main id="conteudo" class="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6" tabindex="-1">
        <PageSkeleton v-if="app.status !== 'ready'" :variant="route.meta.skeleton" />
        <div v-else-if="forbidden" class="card">
          <EmptyState :icon="Lock" title="Acesso restrito" description="Seu perfil não tem permissão para acessar esta área. Fale com o responsável pelo estabelecimento.">
            <AppButton :to="{ name: 'dashboard' }">Voltar para a visão geral</AppButton>
          </EmptyState>
        </div>
        <RouterView v-else v-slot="{ Component }">
          <component :is="Component" :key="`${session.establishment?.id}:${String(route.name)}:${route.params.id ?? ''}`" />
        </RouterView>
      </main>
    </div>
  </div>
</template>
