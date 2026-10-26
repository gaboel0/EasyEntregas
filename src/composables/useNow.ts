import { readonly, ref } from 'vue'

/**
 * Relógio compartilhado, atualizado a cada 30 s. Usado em tempos de espera e alertas,
 * sem criar um timer por componente.
 */
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

export function useNow() {
  if (!timer && typeof window !== 'undefined') {
    timer = setInterval(() => (now.value = new Date()), 30_000)
  }
  return readonly(now)
}

/** Força a atualização imediata (ex.: após uma mutação). */
export function tickNow() {
  now.value = new Date()
}
