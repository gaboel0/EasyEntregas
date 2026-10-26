import { computed, ref } from 'vue'

/**
 * Estado da barra lateral (contrato reutilizável).
 *
 * - Desktop (>= 768px): a barra nunca some; alterna entre aberta (largura cheia) e trilho de ícones.
 *   A escolha é persistida em localStorage.
 * - Mobile (< 768px): vira uma gaveta por cima do conteúdo. Nunca é persistida, nunca abre sozinha
 *   e não altera a preferência do desktop.
 * - Ao cruzar para mobile a gaveta fecha; ao voltar ao desktop a preferência salva é restaurada.
 * - Recolhimento temporário: uma tela de foco chama `requestCollapsed(true)` sem gravar preferência.
 *   Se a pessoa abrir/fechar à mão, a escolha dela vence e o pedido é desfeito.
 *
 * Os tamanhos e a animação vêm dos tokens CSS --sidebar-gap, --sidebar-width, --sidebar-rail e
 * --sidebar-motion (style.css), lidos tanto pela barra quanto pelo conteúdo ao lado.
 */

export const SIDEBAR_BREAKPOINT = 768
const KEY = 'rotacerta:sidebar-open'

const query = typeof window !== 'undefined' ? window.matchMedia?.(`(min-width: ${SIDEBAR_BREAKPOINT}px)`) : undefined

function readPreference(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false'
  } catch {
    return true
  }
}

const isDesktop = ref(query?.matches ?? true)
const preferred = ref(readPreference())
/** `false` = recolhimento temporário pedido por uma tela; `null` = sem pedido. */
const temporary = ref<false | null>(null)
const drawerOpen = ref(false)

query?.addEventListener('change', (event) => {
  isDesktop.value = event.matches
  if (!event.matches) drawerOpen.value = false
})

/** Aberta (largura cheia) no desktop, considerando a preferência e o pedido temporário. */
const desktopOpen = computed(() => temporary.value ?? preferred.value)

function toggle() {
  if (isDesktop.value) {
    const next = !desktopOpen.value
    temporary.value = null
    preferred.value = next
    try {
      localStorage.setItem(KEY, String(next))
    } catch {
      /* preferência vale só nesta sessão */
    }
  } else {
    drawerOpen.value = !drawerOpen.value
  }
}

/** Telas de foco: recolhe sem gravar preferência (`true`) ou libera o pedido (`false`). */
function requestCollapsed(collapsed: boolean) {
  temporary.value = collapsed ? false : null
}

export function useSidebar() {
  return {
    isDesktop,
    desktopOpen,
    drawerOpen,
    /** Barra no modo trilho (somente desktop). */
    collapsed: computed(() => isDesktop.value && !desktopOpen.value),
    /** Estado "aberto" no modo atual, para aria-expanded. */
    expanded: computed(() => (isDesktop.value ? desktopOpen.value : drawerOpen.value)),
    toggle,
    closeDrawer() {
      drawerOpen.value = false
    },
    requestCollapsed,
  }
}
