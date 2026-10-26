import type { Permission, UserRole } from '@/types/domain'

/**
 * Matriz de permissões por papel. No frontend ela serve apenas para esconder/desabilitar ações;
 * a autorização real precisa ser imposta pelo backend em cada endpoint.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  owner: [
    'orders.create',
    'orders.edit',
    'orders.change_status',
    'orders.cancel',
    'dispatch.assign',
    'couriers.manage',
    'reports.view',
    'settings.manage',
    'users.manage',
  ],
  manager: [
    'orders.create',
    'orders.edit',
    'orders.change_status',
    'orders.cancel',
    'dispatch.assign',
    'couriers.manage',
    'reports.view',
    'settings.manage',
  ],
  dispatcher: ['orders.change_status', 'dispatch.assign', 'orders.edit'],
  attendant: ['orders.create', 'orders.edit', 'orders.change_status'],
}

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
  dispatcher: 'Despachante',
  attendant: 'Atendente',
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  'orders.create': 'Cadastrar pedidos',
  'orders.edit': 'Editar pedidos',
  'orders.change_status': 'Alterar status',
  'orders.cancel': 'Cancelar pedidos',
  'dispatch.assign': 'Atribuir motoboys',
  'couriers.manage': 'Gerenciar motoboys',
  'reports.view': 'Ver relatórios',
  'settings.manage': 'Alterar configurações',
  'users.manage': 'Gerenciar usuários',
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}
