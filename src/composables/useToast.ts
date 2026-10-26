import { reactive } from 'vue'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

const toasts = reactive<Toast[]>([])
let nextId = 1

function dismiss(id: number) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index >= 0) toasts.splice(index, 1)
}

function push(tone: ToastTone, title: string, description?: string, timeoutMs = tone === 'error' ? 7000 : 4000) {
  const id = nextId++
  toasts.push({ id, tone, title, description })
  if (toasts.length > 4) toasts.shift()
  setTimeout(() => dismiss(id), timeoutMs)
  return id
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (title: string, description?: string) => push('success', title, description),
    error: (title: string, description?: string) => push('error', title, description),
    info: (title: string, description?: string) => push('info', title, description),
    warning: (title: string, description?: string) => push('warning', title, description),
  }
}
