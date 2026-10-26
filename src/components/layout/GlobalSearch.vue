<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bike, Search } from 'lucide-vue-next'
import { useOrdersStore } from '@/stores/orders'
import { useCouriersStore } from '@/stores/couriers'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatCurrency, formatOrderNumber, onlyDigits } from '@/utils/format'
import { normalizeText } from '@/utils/text'
import type { OrderStatus } from '@/types/domain'

const router = useRouter()
const orders = useOrdersStore()
const couriers = useCouriersStore()

const query = ref('')
const focused = ref(false)
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)

type Result =
  | { kind: 'order'; id: string; title: string; subtitle: string; status: OrderStatus; amount: number }
  | { kind: 'courier'; id: string; title: string; subtitle: string }

const results = computed<Result[]>(() => {
  const q = normalizeText(query.value.trim().replace(/^#/, ''))
  if (q.length < 2) return []
  const digits = onlyDigits(q)
  const orderHits = orders.views
    .filter((v) => {
      const o = v.order
      return (
        String(o.number).startsWith(q) ||
        normalizeText(o.customerName).includes(q) ||
        normalizeText(`${o.address.street} ${o.address.district}`).includes(q) ||
        (digits.length >= 4 && onlyDigits(o.customerPhone).includes(digits))
      )
    })
    .slice(0, 6)
    .map<Result>((v) => ({
      kind: 'order',
      id: v.order.id,
      title: `${formatOrderNumber(v.order.number)} · ${v.order.customerName}`,
      subtitle: `${v.order.address.street}, ${v.order.address.number} — ${v.order.address.district}`,
      status: v.order.status,
      amount: v.total,
    }))
  const courierHits = couriers.couriers
    .filter((c) => normalizeText(c.name).includes(q) || normalizeText(c.link.internalCode).includes(q))
    .slice(0, 3)
    .map<Result>((c) => ({ kind: 'courier', id: c.id, title: c.name, subtitle: `Motoboy · ${c.link.internalCode}` }))
  return [...orderHits, ...courierHits]
})

function open(result: Result | undefined) {
  if (!result) return
  router.push(result.kind === 'order' ? { name: 'order-detail', params: { id: result.id } } : { name: 'courier-detail', params: { id: result.id } })
  query.value = ''
  input.value?.blur()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = Math.min(active.value + 1, results.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    open(results.value[active.value])
  } else if (event.key === 'Escape') {
    query.value = ''
    input.value?.blur()
  }
}

function onGlobalKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
    event.preventDefault()
    input.value?.focus()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <div class="relative w-full max-w-md">
    <Search :size="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden="true" />
    <input
      ref="input"
      v-model="query"
      type="search"
      class="field-input h-10 border-transparent! bg-slate-100/70! pr-10 pl-9 shadow-none! focus:ring-brand-500/50!"
      placeholder="Buscar pedido, cliente, telefone ou motoboy"
      aria-label="Busca global"
      role="combobox"
      :aria-expanded="focused && results.length > 0"
      aria-controls="global-search-results"
      autocomplete="off"
      @focus="focused = true"
      @blur="focused = false"
      @input="active = 0"
      @keydown="onKeydown"
    />
    <kbd class="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded bg-slate-200/60 px-1.5 text-xs text-slate-400 sm:block">/</kbd>
    <ul
      v-if="focused && query.trim().length >= 2"
      id="global-search-results"
      role="listbox"
      class="absolute top-full right-0 left-0 z-40 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-surface p-1 shadow-lg"
    >
      <li v-if="!results.length" class="px-3 py-4 text-center text-sm text-slate-500">Nenhum resultado para “{{ query }}”.</li>
      <li
        v-for="(r, index) in results"
        :key="r.kind + r.id"
        role="option"
        :aria-selected="index === active"
        class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2"
        :class="index === active ? 'bg-slate-100' : ''"
        @mousedown.prevent="open(r)"
        @mouseenter="active = index"
      >
        <Bike v-if="r.kind === 'courier'" :size="16" class="shrink-0 text-slate-400" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-900">{{ r.title }}</p>
          <p class="truncate text-xs text-slate-500">{{ r.subtitle }}</p>
        </div>
        <template v-if="r.kind === 'order'">
          <span class="tabular text-xs text-slate-500">{{ formatCurrency(r.amount) }}</span>
          <StatusBadge :status="r.status" />
        </template>
      </li>
    </ul>
  </div>
</template>
