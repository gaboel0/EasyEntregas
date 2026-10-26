<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import NumberInput from '@/components/ui/NumberInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { formatCurrency } from '@/utils/format'

export interface ItemDraft {
  key: string
  id?: string
  name: string
  quantity: number | null
  unitPrice: number | null
  notes: string
}

const items = defineModel<ItemDraft[]>({ required: true })
defineProps<{ error: (path: string) => string | undefined }>()

let counter = 0
function add() {
  items.value = [...items.value, { key: `new-${Date.now()}-${counter++}`, name: '', quantity: 1, unitPrice: null, notes: '' }]
  requestAnimationFrame(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-item-name]')
    inputs[inputs.length - 1]?.focus()
  })
}

function remove(index: number) {
  items.value = items.value.filter((_, i) => i !== index)
}

const lineTotal = (item: ItemDraft) => (item.quantity ?? 0) * (item.unitPrice ?? 0)
</script>

<template>
  <div>
    <div class="hidden grid-cols-[minmax(0,1fr)_5rem_8rem_7rem_2rem] gap-2 px-1 pb-1 text-xs font-medium text-slate-500 md:grid">
      <span>Produto</span><span>Qtd.</span><span>Preço unit.</span><span class="text-right">Subtotal</span><span />
    </div>
    <ul class="space-y-2">
      <li v-for="(item, index) in items" :key="item.key" class="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 rounded-lg bg-slate-100/50 p-2 md:grid-cols-[minmax(0,1fr)_5rem_8rem_7rem_2rem] md:bg-transparent md:p-0">
        <div class="col-span-2 md:col-span-1">
          <input
            v-model="item.name"
            data-item-name
            class="field-input"
            :aria-label="`Produto ${index + 1}`"
            placeholder="Ex.: Pizza calabresa (grande)"
            :aria-invalid="!!error(`items.${index}.name`) || undefined"
            maxlength="120"
          />
          <input v-model="item.notes" class="field-input mt-1 py-1 text-xs" :aria-label="`Observação do produto ${index + 1}`" placeholder="Observação (opcional): sem cebola, meia a meia…" maxlength="160" />
          <p v-if="error(`items.${index}.name`)" class="mt-1 text-xs text-rose-600">{{ error(`items.${index}.name`) }}</p>
        </div>
        <div>
          <NumberInput v-model="item.quantity" :decimals="0" :aria-label="`Quantidade do produto ${index + 1}`" :invalid="!!error(`items.${index}.quantity`)" />
          <p v-if="error(`items.${index}.quantity`)" class="mt-1 text-xs text-rose-600">{{ error(`items.${index}.quantity`) }}</p>
        </div>
        <div>
          <NumberInput v-model="item.unitPrice" prefix="R$" :aria-label="`Preço unitário do produto ${index + 1}`" :invalid="!!error(`items.${index}.unitPrice`)" />
          <p v-if="error(`items.${index}.unitPrice`)" class="mt-1 text-xs text-rose-600">{{ error(`items.${index}.unitPrice`) }}</p>
        </div>
        <p class="tabular flex items-center justify-end text-sm font-medium text-slate-700 md:h-[38px]">{{ formatCurrency(lineTotal(item)) }}</p>
        <button
          type="button"
          class="grid size-9 place-items-center justify-self-end rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
          :disabled="items.length === 1"
          :aria-label="`Remover produto ${index + 1}`"
          @click="remove(index)"
        >
          <Trash2 :size="15" />
        </button>
      </li>
    </ul>
    <AppButton class="mt-2" size="sm" variant="ghost" :icon="Plus" @click="add">Adicionar produto</AppButton>
  </div>
</template>
