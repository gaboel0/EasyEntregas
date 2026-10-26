import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AuthRole } from '@/services'

const SLUG: Record<AuthRole, string> = { establishment: 'estabelecimento', courier: 'entregador' }

/**
 * Perfil escolhido nas telas de acesso, guardado na URL (?perfil=) para sobreviver à navegação
 * entre login e cadastro. É só contexto visual: não concede permissão nenhuma.
 */
export function useAuthRole() {
  const route = useRoute()
  const router = useRouter()

  const role = computed<AuthRole>({
    get: () => (route.query.perfil === SLUG.courier ? 'courier' : 'establishment'),
    set: (value) => router.replace({ query: { ...route.query, perfil: SLUG[value] } }),
  })

  /** Query para links entre as telas de acesso mantendo o perfil. */
  const roleQuery = computed(() => ({ perfil: SLUG[role.value] }))

  return { role, roleQuery }
}
