import type { OrderHistoryEntry } from '@/types/domain'
import { ORDER_STATUS_LABEL } from './orderWorkflow'

/** Texto curto e legível para um evento do histórico do pedido. */
export function describeHistoryEntry(entry: OrderHistoryEntry): string {
  switch (entry.kind) {
    case 'status_change':
      return entry.from === null ? 'Pedido registrado' : `${ORDER_STATUS_LABEL[entry.from]} → ${ORDER_STATUS_LABEL[entry.to]}`
    case 'order_edited':
      return `Dados alterados: ${entry.changedFields.join(', ')}`
    case 'courier_assigned':
      return `Motoboy atribuído: ${entry.courierName}`
    case 'courier_unassigned':
      return `Motoboy removido: ${entry.courierName}`
  }
}
