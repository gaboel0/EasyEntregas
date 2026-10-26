<script setup lang="ts">
import { Check, Moon, RotateCcw, Sun } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { BRAND_PRESETS, DEFAULT_BRAND_HUE, useAppearance, type ThemeMode } from '@/composables/useAppearance'
import { computed } from 'vue'

const { theme, setTheme, brandHue, setBrandHue, resetBrand } = useAppearance()

const themeModel = computed<ThemeMode>({ get: () => theme.value, set: (v) => setTheme(v) })
const themeOptions = [
  { value: 'light' as ThemeMode, label: 'Claro' },
  { value: 'dark' as ThemeMode, label: 'Escuro' },
]
</script>

<template>
  <section class="card">
    <div class="card-header"><h2 class="card-title">Aparência</h2></div>
    <div class="space-y-6 p-4">
      <div>
        <p class="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
          <Sun v-if="theme === 'light'" :size="15" aria-hidden="true" /><Moon v-else :size="15" aria-hidden="true" /> Tema
        </p>
        <p class="mb-2 text-xs text-slate-500">Na primeira visita seguimos o tema do seu sistema. Depois, vale a sua escolha.</p>
        <SegmentedControl v-model="themeModel" :options="themeOptions" label="Tema da interface" />
      </div>

      <div>
        <p class="mb-1 text-sm font-medium text-slate-800">Cor principal</p>
        <p class="mb-3 text-xs text-slate-500">Aparece em botões, links e itens ativos. Os fundos neutros do tema não mudam.</p>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor principal">
          <button
            v-for="p in BRAND_PRESETS"
            :key="p.key"
            type="button"
            role="radio"
            :aria-checked="brandHue === p.hue"
            :title="p.label"
            class="grid size-9 place-items-center rounded-full text-white ring-offset-2 ring-offset-card transition-shadow"
            :class="brandHue === p.hue ? 'ring-2 ring-slate-900' : 'hover:ring-2 hover:ring-slate-300'"
            :style="{ background: `oklch(0.55 0.22 ${p.hue})` }"
            @click="setBrandHue(p.hue)"
          >
            <Check v-if="brandHue === p.hue" :size="16" aria-hidden="true" />
            <span class="sr-only">{{ p.label }}</span>
          </button>
        </div>
        <AppButton v-if="brandHue !== DEFAULT_BRAND_HUE" class="mt-3" size="sm" variant="ghost" :icon="RotateCcw" @click="resetBrand">Voltar ao azul padrão</AppButton>
      </div>

      <p class="text-xs text-slate-500">Estas preferências ficam salvas neste navegador. Com o backend, a cor principal passará a fazer parte dos dados do estabelecimento.</p>
    </div>
  </section>
</template>
