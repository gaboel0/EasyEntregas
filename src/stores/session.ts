import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Establishment, Permission, User } from '@/types/domain'
import { dataSource, type DemoSessionOption } from '@/services'
import { hasPermission } from '@/modules/settings/permissions'

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(null)
  const establishment = ref<Establishment | null>(null)
  const demoOptions = ref<DemoSessionOption[]>([])
  const isDemo = computed(() => dataSource.demo !== null)

  async function load() {
    const session = await dataSource.establishment.getSession()
    user.value = session.user
    establishment.value = session.establishment
    if (dataSource.demo) demoOptions.value = await dataSource.demo.listSessionOptions()
  }

  /** Controle de interface. A autorização definitiva é responsabilidade do backend. */
  function can(permission: Permission): boolean {
    return !!user.value && hasPermission(user.value.role, permission)
  }

  return { user, establishment, demoOptions, isDemo, load, can }
})
