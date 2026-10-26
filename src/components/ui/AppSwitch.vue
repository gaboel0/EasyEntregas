<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label: string; description?: string; disabled?: boolean }>()
const model = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <label :for="id" class="text-sm font-medium text-slate-800">{{ label }}</label>
      <p v-if="description" class="mt-0.5 text-xs text-slate-500">{{ description }}</p>
    </div>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="model ? 'bg-primary' : 'bg-slate-300'"
      @click="model = !model"
    >
      <span class="inline-block size-4 rounded-full bg-surface shadow transition-transform" :class="model ? 'translate-x-4.5' : 'translate-x-0.5'" />
    </button>
  </div>
</template>
