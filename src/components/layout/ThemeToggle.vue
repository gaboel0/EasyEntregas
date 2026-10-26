<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useAppearance } from '@/composables/useAppearance'

const { isDark, toggleTheme } = useAppearance()
</script>

<template>
  <button
    type="button"
    class="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    :aria-label="isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'"
    :title="isDark ? 'Tema claro' : 'Tema escuro'"
    :aria-pressed="isDark"
    @click="toggleTheme"
  >
    <Sun v-if="isDark" :size="18" aria-hidden="true" />
    <Moon v-else :size="18" aria-hidden="true" />
  </button>
</template>
