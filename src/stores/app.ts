import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ID } from '@/types/domain'
import { dataSource, errorMessage } from '@/services'
import { useSessionStore } from './session'
import { useSettingsStore } from './settings'
import { useCouriersStore } from './couriers'
import { useOrdersStore } from './orders'

type BootStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Orquestra o carregamento inicial e as recargas de todos os dados do estabelecimento. */
export const useAppStore = defineStore('app', () => {
  const status = ref<BootStatus>('idle')
  const error = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  async function loadAll() {
    const session = useSessionStore()
    await session.load()
    // Configurações e motoboys antes dos pedidos: as visões de pedido dependem deles.
    await Promise.all([useSettingsStore().load(), useCouriersStore().load()])
    await useOrdersStore().load()
  }

  async function init() {
    if (status.value === 'loading' || status.value === 'ready') return
    status.value = 'loading'
    error.value = null
    try {
      await loadAll()
      status.value = 'ready'
      unsubscribe ??= dataSource.demo?.onExternalChange(() => void refresh()) ?? null
    } catch (e) {
      error.value = errorMessage(e)
      status.value = 'error'
    }
  }

  /** Recarrega mantendo a interface montada (ex.: alteração feita em outra aba). */
  async function refresh() {
    try {
      await loadAll()
    } catch (e) {
      error.value = errorMessage(e)
    }
  }

  async function retry() {
    status.value = 'idle'
    await init()
  }

  async function switchSession(establishmentId: ID, userId: ID) {
    if (!dataSource.demo) return
    await dataSource.demo.switchSession(establishmentId, userId)
    status.value = 'loading'
    await loadAll()
    status.value = 'ready'
  }

  async function resetDemoData() {
    if (!dataSource.demo) return
    await dataSource.demo.resetDemoData()
    status.value = 'loading'
    await loadAll()
    status.value = 'ready'
  }

  return { status, error, init, refresh, retry, switchSession, resetDemoData }
})
