<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{ id?: string; invalid?: boolean; describedby?: string; autocomplete: 'current-password' | 'new-password' }>()
const model = defineModel<string>({ required: true })
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      class="field-input pr-11"
      :autocomplete="autocomplete"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      maxlength="128"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700"
      :aria-label="visible ? 'Ocultar senha' : 'Mostrar senha'"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" :size="17" aria-hidden="true" />
      <Eye v-else :size="17" aria-hidden="true" />
    </button>
  </div>
</template>
