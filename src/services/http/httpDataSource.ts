import { ServiceError, type DataSource, type ServiceErrorCode } from '../contracts'

/**
 * Adaptador HTTP para uma API REST futura. Ele implementa os mesmos contratos da fonte local,
 * então trocar `VITE_DATA_SOURCE=local` por `http` não exige mudanças nas páginas ou stores.
 *
 * Endpoints esperados (todos escopados pelo estabelecimento do token):
 *   GET    /session                         → SessionContext
 *   GET    /settings            PUT /settings
 *   PUT    /establishment
 *   GET    /users               POST /users   PUT /users/:id
 *   GET    /orders                          → OrdersSnapshot (paginar/filtrar por período em produção)
 *   POST   /orders              PUT /orders/:id
 *   POST   /orders/:id/status               { to, note }
 *   PUT    /orders/:id/courier              { courierId }
 *   DELETE /orders/:id/courier
 *   GET    /couriers            POST /couriers   PUT /couriers/:id
 *   PUT    /couriers/:id/shift              { status }
 *
 * Autenticação: o token deve ficar em cookie httpOnly emitido pelo backend (recomendado) — por isso
 * as requisições usam `credentials: 'include'` e nenhum segredo é guardado no frontend.
 */

const STATUS_TO_CODE: Record<number, ServiceErrorCode> = {
  400: 'validation',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'invalid_transition',
}

export function createHttpDataSource(baseUrl: string): DataSource {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ServiceError('network', 'Não foi possível conectar ao servidor. Verifique sua conexão.')
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      throw new ServiceError(STATUS_TO_CODE[response.status] ?? 'unknown', payload?.message ?? `Erro ${response.status} ao comunicar com o servidor.`)
    }
    return (response.status === 204 ? undefined : await response.json()) as T
  }

  const get = <T>(path: string) => request<T>('GET', path)
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {})
  const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {})
  const del = <T>(path: string) => request<T>('DELETE', path)
  const id = encodeURIComponent

  return {
    orders: {
      list: () => get('/orders'),
      create: (input) => post('/orders', input),
      update: (orderId, input) => put(`/orders/${id(orderId)}`, input),
      changeStatus: (orderId, req) => post(`/orders/${id(orderId)}/status`, req),
      assignCourier: (orderId, courierId) => put(`/orders/${id(orderId)}/courier`, { courierId }),
      unassignCourier: (orderId) => del(`/orders/${id(orderId)}/courier`),
    },
    couriers: {
      list: () => get('/couriers'),
      create: (input) => post('/couriers', input),
      update: (courierId, input) => put(`/couriers/${id(courierId)}`, input),
      setShiftStatus: (courierId, status) => put(`/couriers/${id(courierId)}/shift`, { status }),
    },
    establishment: {
      getSession: () => get('/session'),
      getSettings: () => get('/settings'),
      updateEstablishment: (input) => put('/establishment', input),
      updateSettings: (input) => put('/settings', input),
      listUsers: () => get('/users'),
      saveUser: (input, userId) => (userId ? put(`/users/${id(userId)}`, input) : post('/users', input)),
    },
    demo: null,
  }
}
