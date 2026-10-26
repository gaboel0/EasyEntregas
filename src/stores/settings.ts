import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ID, OperationalSettings, User } from '@/types/domain'
import { dataSource } from '@/services'
import type { EstablishmentInput, OperationalSettingsInput, UserInput } from '@/modules/settings/settingsSchema'
import { useSessionStore } from './session'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<OperationalSettings | null>(null)
  const users = ref<User[]>([])

  async function load() {
    const [s, u] = await Promise.all([dataSource.establishment.getSettings(), dataSource.establishment.listUsers()])
    settings.value = s
    users.value = u
  }

  /** Configurações garantidamente carregadas (o app só renderiza páginas após o bootstrap). */
  function current(): OperationalSettings {
    if (!settings.value) throw new Error('Configurações ainda não carregadas.')
    return settings.value
  }

  async function updateSettings(input: OperationalSettingsInput) {
    settings.value = await dataSource.establishment.updateSettings(input)
  }

  async function updateEstablishment(input: EstablishmentInput) {
    const session = useSessionStore()
    session.establishment = await dataSource.establishment.updateEstablishment(input)
  }

  async function saveUser(input: UserInput, userId?: ID) {
    const saved = await dataSource.establishment.saveUser(input, userId)
    const index = users.value.findIndex((u) => u.id === saved.id)
    if (index >= 0) users.value.splice(index, 1, saved)
    else users.value.push(saved)
    return saved
  }

  return { settings, users, load, current, updateSettings, updateEstablishment, saveUser }
})
