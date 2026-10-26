import { beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase, createMemoryStorage, type KeyValueStorage } from '@/services/local/localDatabase'
import { createDemoDatabase } from '@/services/local/demoSeed'
import { createLocalDataSource } from '@/services/local/localDataSource'
import { ServiceError, type DataSource } from '@/services/contracts'
import type { OrderInput } from '@/modules/orders/orderSchema'

const NOW = new Date('2026-10-26T21:00:00-03:00')

function sampleInput(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    fulfillment: 'delivery',
    customerName: 'Cliente Teste',
    customerPhone: '(11) 98888-7777',
    address: {
      street: 'Rua Exemplo',
      number: '100',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      location: null,
      distanceKm: 3,
      distanceSource: 'manual',
    },
    source: 'whatsapp',
    items: [{ name: 'Pizza grande', quantity: 2, unitPrice: 50 }],
    freightFee: 8,
    payment: { method: 'cash', changeFor: 150 },
    ...overrides,
  }
}

let storage: KeyValueStorage
let db: LocalDatabase
let ds: DataSource

beforeEach(() => {
  storage = createMemoryStorage()
  db = new LocalDatabase(storage, () => createDemoDatabase(NOW))
  ds = createLocalDataSource(db, { now: () => NOW })
})

async function expectServiceError(promise: Promise<unknown>, code: ServiceError['code']) {
  await expect(promise).rejects.toBeInstanceOf(ServiceError)
  await promise.catch((e: ServiceError) => expect(e.code).toBe(code))
}

describe('pedidos no serviço local', () => {
  it('cadastra o pedido com entrega separada e histórico inicial', async () => {
    const { order, deliveries, history } = await ds.orders.create(sampleInput())
    expect(order.status).toBe('received')
    expect(order.productsTotal).toBe(100)
    expect(order.freightFee).toBe(8)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]!.orderId).toBe(order.id)
    expect(deliveries[0]!.status).toBe('unassigned')
    expect(history[0]).toMatchObject({ kind: 'status_change', from: null, to: 'received' })
  })

  it('valida os dados no servidor (troco menor que o total)', async () => {
    await expectServiceError(ds.orders.create(sampleInput({ payment: { method: 'cash', changeFor: 50 } })), 'validation')
  })

  it('percorre o fluxo completo e congela o custo na entrega', async () => {
    const { order } = await ds.orders.create(sampleInput())
    const couriers = await ds.couriers.list()
    const courier = couriers.find((c) => c.link.shiftStatus === 'available')!

    await ds.orders.changeStatus(order.id, { to: 'preparing' })
    await ds.orders.changeStatus(order.id, { to: 'ready_for_pickup' })
    await ds.orders.changeStatus(order.id, { to: 'awaiting_courier' })
    await expectServiceError(ds.orders.changeStatus(order.id, { to: 'out_for_delivery' }), 'invalid_transition')

    await ds.orders.assignCourier(order.id, courier.id)
    const out = await ds.orders.changeStatus(order.id, { to: 'out_for_delivery' })
    expect(out.deliveries[0]!.status).toBe('in_transit')
    expect(out.deliveries[0]!.dispatchedAt).not.toBeNull()

    const done = await ds.orders.changeStatus(order.id, { to: 'delivered' })
    expect(done.order.status).toBe('delivered')
    expect(done.deliveries[0]!.status).toBe('delivered')
    expect(done.deliveries[0]!.costSnapshot?.freightFee).toBe(8)
    const statuses = done.history.filter((h) => h.kind === 'status_change').map((h) => (h.kind === 'status_change' ? h.to : null))
    expect(statuses).toEqual(['received', 'preparing', 'ready_for_pickup', 'awaiting_courier', 'out_for_delivery', 'delivered'])
  })

  it('bloqueia transições inválidas', async () => {
    const { order } = await ds.orders.create(sampleInput())
    await expectServiceError(ds.orders.changeStatus(order.id, { to: 'delivered' }), 'invalid_transition')
  })

  it('exige motivo para cancelar', async () => {
    const { order } = await ds.orders.create(sampleInput())
    await expectServiceError(ds.orders.changeStatus(order.id, { to: 'cancelled' }), 'validation')
    const cancelled = await ds.orders.changeStatus(order.id, { to: 'cancelled', note: 'Cliente desistiu' })
    expect(cancelled.order.status).toBe('cancelled')
    expect(cancelled.deliveries[0]!.status).toBe('cancelled')
  })

  it('cria nova tentativa de entrega após falha', async () => {
    const courier = (await ds.couriers.list()).find((c) => c.link.shiftStatus === 'available')!
    const { order } = await ds.orders.create(sampleInput({ courierId: courier.id }))
    for (const to of ['preparing', 'ready_for_pickup', 'awaiting_courier', 'out_for_delivery'] as const) {
      await ds.orders.changeStatus(order.id, { to })
    }
    const failed = await ds.orders.changeStatus(order.id, { to: 'delivery_failed', note: 'Cliente ausente' })
    expect(failed.deliveries[0]!.status).toBe('failed')
    expect(failed.deliveries[0]!.costSnapshot).not.toBeNull()

    const retry = await ds.orders.changeStatus(order.id, { to: 'awaiting_courier' })
    expect(retry.deliveries).toHaveLength(2)
    expect(retry.deliveries.find((d) => d.attempt === 2)).toMatchObject({ status: 'unassigned', courierId: null })
  })

  it('não altera nada quando a operação falha no meio (transação)', async () => {
    const before = (await ds.orders.list()).orders.length
    await expectServiceError(ds.orders.create(sampleInput({ courierId: 'cur_inexistente' })), 'not_found')
    expect((await ds.orders.list()).orders.length).toBe(before)
  })

  it('registra edição com os campos alterados', async () => {
    const { order } = await ds.orders.create(sampleInput())
    const updated = await ds.orders.update(order.id, sampleInput({ freightFee: 10, customerName: 'Outro Nome' }))
    const edit = updated.history.find((h) => h.kind === 'order_edited')
    expect(edit && edit.kind === 'order_edited' ? edit.changedFields : []).toEqual(['Cliente', 'Frete'])
  })
})

describe('isolamento e permissões', () => {
  it('não expõe pedidos de outro estabelecimento', async () => {
    const own = await ds.orders.list()
    expect(own.orders.every((o) => o.establishmentId === 'est_bellanapoli')).toBe(true)

    const foreign = db.read().orders.find((o) => o.establishmentId === 'est_brasaburger')!
    await expectServiceError(ds.orders.changeStatus(foreign.id, { to: 'preparing' }), 'not_found')
  })

  it('motoboy compartilhado aparece com o vínculo de cada estabelecimento', async () => {
    const mine = (await ds.couriers.list()).find((c) => c.id === 'cur_rafael')!
    await ds.demo!.switchSession('est_brasaburger', 'usr_marina')
    const theirs = (await ds.couriers.list()).find((c) => c.id === 'cur_rafael')!
    expect(mine.link.internalCode).toBe('MB-02')
    expect(theirs.link.internalCode).toBe('BB-07')
    expect((await ds.couriers.list()).some((c) => c.id === 'cur_carlos')).toBe(false)
  })

  it('atendente não pode cancelar pedidos', async () => {
    const { order } = await ds.orders.create(sampleInput())
    await ds.demo!.switchSession('est_bellanapoli', 'usr_ana')
    await expectServiceError(ds.orders.changeStatus(order.id, { to: 'cancelled', note: 'teste' }), 'forbidden')
  })

  it('não permite atribuir motoboy indisponível', async () => {
    const { order } = await ds.orders.create(sampleInput())
    await expectServiceError(ds.orders.assignCourier(order.id, 'cur_marcos'), 'conflict')
  })
})

describe('persistência', () => {
  it('mantém os dados após recriar a fonte (equivalente a recarregar a página)', async () => {
    const { order } = await ds.orders.create(sampleInput())
    const reloaded = createLocalDataSource(new LocalDatabase(storage, () => createDemoDatabase(NOW)), { now: () => NOW })
    const snapshot = await reloaded.orders.list()
    expect(snapshot.orders.some((o) => o.id === order.id)).toBe(true)
  })
})
