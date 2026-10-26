import { reactive } from 'vue'
import type { ID, OrderStatus } from '@/types/domain'
import type { OrderView } from '@/modules/orders/orderViews'
import {
  allowedTargets,
  canAssignCourier,
  canTransition,
  nextStatus,
  ORDER_STATUS_ACTION_LABEL,
  ORDER_STATUS_LABEL,
} from '@/modules/orders/orderWorkflow'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { useConfirm } from './useConfirm'
import { useToast } from './useToast'
import { errorMessage } from '@/services'
import { formatOrderNumber } from '@/utils/format'

export interface StatusAction {
  to: OrderStatus
  label: string
  kind: 'primary' | 'secondary' | 'danger'
  /** Motivo pelo qual a ação está bloqueada (exibido como dica). */
  blockedReason?: string
}

const pending = reactive(new Set<ID>())

/**
 * Ações operacionais sobre pedidos com confirmação, feedback e tratamento de erro.
 * Compartilhado por lista, detalhe, despacho e mapa para que o comportamento seja idêntico.
 */
export function useOrderActions() {
  const orders = useOrdersStore()
  const session = useSessionStore()
  const { confirm } = useConfirm()
  const toast = useToast()

  function actionsFor(view: OrderView): StatusAction[] {
    const ctx = { hasCourier: !!view.delivery?.courierId }
    const next = nextStatus(view.order.status)
    return allowedTargets(view.order.status)
      .filter((to) => (to === 'cancelled' ? session.can('orders.cancel') : session.can('orders.change_status')))
      .map((to) => {
        const check = canTransition(view.order.status, to, ctx)
        return {
          to,
          label: view.order.status === 'delivery_failed' && to === 'awaiting_courier' ? 'Nova tentativa de entrega' : ORDER_STATUS_ACTION_LABEL[to],
          kind: to === 'cancelled' || to === 'delivery_failed' ? 'danger' : to === next ? 'primary' : 'secondary',
          blockedReason: check.allowed ? undefined : check.reason,
        } satisfies StatusAction
      })
      .sort((a, b) => order(a.kind) - order(b.kind))
  }

  /** Próxima ação do fluxo principal, para botões de ação rápida. */
  function primaryAction(view: OrderView): StatusAction | null {
    return actionsFor(view).find((a) => a.kind === 'primary') ?? null
  }

  async function changeStatus(view: OrderView, to: OrderStatus): Promise<boolean> {
    const code = formatOrderNumber(view.order.number)
    let note: string | undefined
    if (to === 'cancelled' || to === 'delivery_failed') {
      const answer = await confirm({
        title: to === 'cancelled' ? `Cancelar o pedido ${code}?` : `Registrar falha na entrega ${code}?`,
        description:
          to === 'cancelled'
            ? 'O pedido sai da operação e não poderá ser reaberto.'
            : 'A tentativa será encerrada. Depois você poderá enviar novamente ou cancelar o pedido.',
        tone: 'danger',
        confirmLabel: to === 'cancelled' ? 'Cancelar pedido' : 'Registrar falha',
        reason: { label: 'Motivo', placeholder: to === 'cancelled' ? 'Ex.: cliente desistiu' : 'Ex.: cliente não atendeu', required: true },
      })
      if (!answer.confirmed) return false
      note = answer.reason
    } else if (to === 'delivered' || to === 'out_for_delivery') {
      const answer = await confirm({
        title: to === 'delivered' ? `Confirmar entrega do pedido ${code}?` : `Registrar saída do pedido ${code}?`,
        description:
          to === 'delivered'
            ? `Confirme apenas quando o cliente tiver recebido o pedido. O custo da entrega será registrado com os parâmetros atuais.`
            : `${view.courier?.name ?? 'O motoboy'} sai agora com o pedido para ${view.order.address.street}, ${view.order.address.number}.`,
        confirmLabel: to === 'delivered' ? 'Confirmar entrega' : 'Registrar saída',
      })
      if (!answer.confirmed) return false
    }

    pending.add(view.order.id)
    try {
      await orders.changeStatus(view.order.id, { to, note })
      toast.success(`${code}: ${ORDER_STATUS_LABEL[to]}`)
      return true
    } catch (e) {
      toast.error('Não foi possível alterar o status', errorMessage(e))
      return false
    } finally {
      pending.delete(view.order.id)
    }
  }

  async function assignCourier(view: OrderView, courierId: ID, courierName: string): Promise<boolean> {
    pending.add(view.order.id)
    try {
      await orders.assignCourier(view.order.id, courierId)
      toast.success(`${courierName} atribuído ao pedido ${formatOrderNumber(view.order.number)}`)
      return true
    } catch (e) {
      toast.error('Não foi possível atribuir o motoboy', errorMessage(e))
      return false
    } finally {
      pending.delete(view.order.id)
    }
  }

  async function unassignCourier(view: OrderView): Promise<boolean> {
    const answer = await confirm({
      title: `Remover ${view.courier?.name ?? 'o motoboy'} do pedido ${formatOrderNumber(view.order.number)}?`,
      description: 'O pedido volta para a fila de atribuição do despacho.',
      confirmLabel: 'Remover motoboy',
      tone: 'danger',
    })
    if (!answer.confirmed) return false
    pending.add(view.order.id)
    try {
      await orders.unassignCourier(view.order.id)
      toast.info('Motoboy removido do pedido')
      return true
    } catch (e) {
      toast.error('Não foi possível remover o motoboy', errorMessage(e))
      return false
    } finally {
      pending.delete(view.order.id)
    }
  }

  const canAssign = (view: OrderView) => session.can('dispatch.assign') && canAssignCourier(view.order.status)
  const isPending = (id: ID) => pending.has(id)

  return { actionsFor, primaryAction, changeStatus, assignCourier, unassignCourier, canAssign, isPending }
}

function order(kind: StatusAction['kind']) {
  return kind === 'primary' ? 0 : kind === 'secondary' ? 1 : 2
}
