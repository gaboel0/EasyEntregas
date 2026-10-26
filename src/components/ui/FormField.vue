<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    label: string
    error?: string
    hint?: string
    required?: boolean
    /** Oculta o rótulo visualmente (mantém para leitores de tela). */
    srOnlyLabel?: boolean
  }>(),
  {},
)

const id = useId()
</script>

<template>
  <div class="min-w-0">
    <label :for="id" class="mb-1 block text-xs font-medium text-slate-700" :class="{ 'sr-only': srOnlyLabel }">
      {{ label }}<span v-if="required" class="ml-0.5 text-rose-600" aria-hidden="true">*</span>
    </label>
    <slot :id="id" :invalid="!!error" :describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined" />
    <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs text-rose-600" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
