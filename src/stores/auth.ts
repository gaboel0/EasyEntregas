import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { dataSource, type AuthSession, type EstablishmentSignUpRequest, type CourierSignUpRequest, type SignInRequest } from '@/services'
import { useAppStore } from './app'

/** Estado de autenticação. Não guarda senhas; o papel real da conta vem do serviço/servidor. */
export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(null)
  const loaded = ref(false)

  const isAuthenticated = computed(() => !!session.value)

  /** Carrega a sessão uma vez (usado pelo guard de rotas). */
  async function ensureLoaded() {
    if (loaded.value) return
    session.value = await dataSource.auth.getSession()
    loaded.value = true
  }

  async function signIn(request: SignInRequest) {
    session.value = await dataSource.auth.signIn(request)
    loaded.value = true
    useAppStore().reset()
    return session.value
  }

  async function signUp(request: EstablishmentSignUpRequest | CourierSignUpRequest) {
    session.value = await dataSource.auth.signUp(request)
    loaded.value = true
    useAppStore().reset()
    return session.value
  }

  async function signOut() {
    await dataSource.auth.signOut()
    session.value = null
    useAppStore().reset()
  }

  return { session, isAuthenticated, ensureLoaded, signIn, signUp, signOut, requestPasswordReset: (email: string) => dataSource.auth.requestPasswordReset(email) }
})
