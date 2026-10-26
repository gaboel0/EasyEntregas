import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  /** Quando definido, exige um texto (ex.: motivo do cancelamento). */
  reason?: { label: string; placeholder?: string; required?: boolean }
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((value: { confirmed: boolean; reason: string }) => void) | null
}

const state = reactive<ConfirmState>({ open: false, title: '', resolve: null })

/**
 * Diálogo de confirmação global. Uso:
 *   const { confirmed, reason } = await confirm({ title: 'Cancelar pedido?', tone: 'danger' })
 */
export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<{ confirmed: boolean; reason: string }> {
    state.resolve?.({ confirmed: false, reason: '' })
    Object.assign(state, { description: undefined, confirmLabel: undefined, cancelLabel: undefined, tone: 'primary', reason: undefined }, options, {
      open: true,
    })
    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }

  function settle(confirmed: boolean, reason = '') {
    state.resolve?.({ confirmed, reason })
    state.resolve = null
    state.open = false
  }

  return { state, confirm, settle }
}
