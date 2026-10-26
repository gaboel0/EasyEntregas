import { ref } from 'vue'
import type { OrderSource } from '@/types/domain'
import type { OrderInput } from '@/modules/orders/orderSchema'
import { useOrdersStore } from '@/stores/orders'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { useToast } from './useToast'
import { errorMessage } from '@/services'

const CUSTOMERS = ['Camila Duarte', 'Rafael Nogueira', 'Beatriz Campos', 'Lucas Tavares', 'Helena Prado', 'Gustavo Reis']
const STREETS = ['Rua Afonso Celso', 'Rua Sena Madureira', 'Rua Humberto I', 'Rua Joaquim Távora']
const PRODUCTS = [
  { name: 'Pizza Calabresa (grande)', price: 62.9 },
  { name: 'Pizza Margherita (grande)', price: 59.9 },
  { name: 'Refrigerante 2 L', price: 14 },
]
const SOURCES: OrderSource[] = ['whatsapp', 'whatsapp', 'instagram']

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!

/**
 * SOMENTE DEMONSTRAÇÃO: cria um pedido fictício pelo mesmo caminho do cadastro manual, só para
 * mostrar como um pedido recebido aparece no painel. Não existe integração com WhatsApp/Instagram.
 */
export function useDemoIncoming() {
  const busy = ref(false)
  const toast = useToast()

  async function simulate() {
    busy.value = true
    try {
      const settings = useSettingsStore().current()
      const establishment = useSessionStore().establishment
      const product = pick(PRODUCTS.slice(0, 2))
      const distanceKm = Math.round((1 + Math.random() * 4) * 10) / 10
      const input: OrderInput = {
        fulfillment: 'delivery',
        customerName: pick(CUSTOMERS),
        customerPhone: `(11) 9${Math.floor(6000 + Math.random() * 3999)}-${Math.floor(1000 + Math.random() * 8999)}`,
        address: {
          street: pick(STREETS),
          number: String(Math.floor(20 + Math.random() * 1500)),
          district: 'Vila Mariana',
          city: establishment?.address.city || 'São Paulo',
          state: establishment?.address.state || 'SP',
          location: null,
          distanceKm,
          distanceSource: 'manual',
        },
        source: pick(SOURCES),
        items: [
          { name: product.name, quantity: 1, unitPrice: product.price },
          { name: PRODUCTS[2]!.name, quantity: 1, unitPrice: PRODUCTS[2]!.price },
        ],
        freightFee: settings.defaultFreightFee,
        payment: { method: 'pix', changeFor: null },
      }
      const order = await useOrdersStore().create(input)
      toast.info(`Pedido fictício #${order.number} recebido`, 'Simulação de demonstração — nenhuma integração está conectada.')
    } catch (e) {
      toast.error('Não foi possível simular o pedido', errorMessage(e))
    } finally {
      busy.value = false
    }
  }

  return { busy, simulate }
}
