import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { RouteLocationRaw } from 'vue-router'
import { useOrdersStore } from './orders'
import { useSettingsStore } from './settings'
import { useSessionStore } from './session'
import { useNow } from '@/composables/useNow'
import { formatDuration, formatOrderNumber } from '@/utils/format'

export interface AppNotification {
  id: string
  tone: 'warning' | 'danger' | 'info'
  title: string
  description: string
  at: string
  to: RouteLocationRaw
}

const READ_KEY = 'rotacerta:notifications-read'
const NEW_ORDER_WINDOW_MIN = 15

/**
 * Alertas operacionais derivados do estado atual dos pedidos (não são mensagens inventadas).
 * O "lido" é apenas uma preferência local do navegador.
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const now = useNow()
  const readIds = ref<Set<string>>(loadRead())

  function loadRead(): Set<string> {
    try {
      return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  }

  const items = computed<AppNotification[]>(() => {
    const prefs = useSettingsStore().settings?.notifications
    if (!prefs) return []
    const list: AppNotification[] = []
    for (const v of useOrdersStore().views) {
      const code = formatOrderNumber(v.order.number)
      const to = { name: 'order-detail', params: { id: v.order.id } }
      if (prefs.longDispatchWait && v.isDispatchLate && v.waitingSince) {
        list.push({
          id: `late:${v.order.id}:${v.waitingSince}`,
          tone: 'warning',
          title: `${code} aguardando despacho`,
          description: `${v.order.customerName} · pronto há ${formatDuration(v.waitingMinutes)}`,
          at: v.waitingSince,
          to,
        })
      }
      if (prefs.deliveryFailed && v.order.status === 'delivery_failed') {
        list.push({
          id: `failed:${v.order.id}:${v.delivery?.id}`,
          tone: 'danger',
          title: `Falha na entrega ${code}`,
          description: v.delivery?.failureReason ?? 'Defina se haverá nova tentativa ou cancelamento.',
          at: v.order.updatedAt,
          to,
        })
      }
      const ageMin = (now.value.getTime() - new Date(v.order.createdAt).getTime()) / 60000
      if (prefs.newOrder && v.order.status === 'received' && ageMin <= NEW_ORDER_WINDOW_MIN) {
        list.push({
          id: `new:${v.order.id}`,
          tone: 'info',
          title: `Novo pedido ${code}`,
          description: `${v.order.customerName} · ${v.order.address.district}`,
          at: v.order.createdAt,
          to,
        })
      }
    }
    return list.sort((a, b) => b.at.localeCompare(a.at))
  })

  const unread = computed(() => items.value.filter((n) => !readIds.value.has(n.id)))

  function persist() {
    try {
      // Mantém apenas IDs ainda relevantes para não crescer indefinidamente.
      const live = new Set(items.value.map((n) => n.id))
      localStorage.setItem(READ_KEY, JSON.stringify([...readIds.value].filter((id) => live.has(id))))
    } catch {
      /* armazenamento indisponível: o estado de leitura vale só para esta sessão */
    }
  }

  function markRead(id: string) {
    readIds.value = new Set(readIds.value).add(id)
    persist()
  }

  function markAllRead() {
    readIds.value = new Set([...readIds.value, ...items.value.map((n) => n.id)])
    persist()
  }

  // Aviso sonoro opcional quando surge um alerta novo nesta sessão.
  let known = new Set<string>()
  let primed = false
  watch(
    () => unread.value.map((n) => n.id),
    (ids) => {
      const fresh = ids.filter((id) => !known.has(id))
      known = new Set(ids)
      if (!primed) {
        primed = true
        return
      }
      if (fresh.length && useSettingsStore().settings?.notifications.playSound) beep()
    },
  )

  watch(
    () => useSessionStore().establishment?.id,
    () => {
      primed = false
    },
  )

  return { items, unread, markRead, markAllRead }
})

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {
    /* navegador bloqueou áudio sem interação: ignorar */
  }
}
