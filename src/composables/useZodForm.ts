import { ref } from 'vue'
import type { ZodType } from 'zod'

/**
 * Validação de formulários com Zod. Os erros ficam indexados pelo caminho do campo
 * ("address.street", "items.0.name") para exibição ao lado de cada input.
 */
export function useZodForm<T>(schema: ZodType<T>) {
  const errors = ref<Record<string, string>>({})
  const submitted = ref(false)

  function validate(values: unknown): T | null {
    submitted.value = true
    const result = schema.safeParse(values)
    if (result.success) {
      errors.value = {}
      return result.data
    }
    const next: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join('.')
      next[key] ??= issue.message
    }
    errors.value = next
    return null
  }

  /** Revalida em tempo real somente depois da primeira tentativa de envio. */
  function revalidate(values: unknown) {
    if (submitted.value) validate(values)
  }

  const error = (path: string): string | undefined => errors.value[path]

  function focusFirstError() {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
  }

  function reset() {
    errors.value = {}
    submitted.value = false
  }

  return { errors, error, validate, revalidate, focusFirstError, reset }
}
