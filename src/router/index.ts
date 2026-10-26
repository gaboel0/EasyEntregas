import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { Permission } from '@/types/domain'
import AppLayout from '@/layouts/AppLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Permissão exigida para exibir a página (o backend também precisa validar). */
    permission?: Permission
    /** Item da navegação lateral que fica ativo nesta rota. */
    section?: string
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Visão geral' } },
      { path: 'pedidos', name: 'orders', component: () => import('@/pages/OrdersPage.vue'), meta: { title: 'Pedidos' } },
      {
        path: 'pedidos/novo',
        name: 'order-new',
        component: () => import('@/pages/OrderFormPage.vue'),
        meta: { title: 'Novo pedido', section: 'orders', permission: 'orders.create' },
      },
      {
        path: 'pedidos/:id',
        name: 'order-detail',
        component: () => import('@/pages/OrderDetailPage.vue'),
        meta: { title: 'Pedido', section: 'orders' },
      },
      {
        path: 'pedidos/:id/editar',
        name: 'order-edit',
        component: () => import('@/pages/OrderFormPage.vue'),
        meta: { title: 'Editar pedido', section: 'orders', permission: 'orders.edit' },
      },
      { path: 'despacho', name: 'dispatch', component: () => import('@/pages/DispatchPage.vue'), meta: { title: 'Despacho' } },
      { path: 'mapa', name: 'map', component: () => import('@/pages/MapPage.vue'), meta: { title: 'Mapa de entregas' } },
      { path: 'motoboys', name: 'couriers', component: () => import('@/pages/CouriersPage.vue'), meta: { title: 'Motoboys' } },
      {
        path: 'motoboys/:id',
        name: 'courier-detail',
        component: () => import('@/pages/CourierDetailPage.vue'),
        meta: { title: 'Motoboy', section: 'couriers' },
      },
      { path: 'calculadora', name: 'calculator', component: () => import('@/pages/CalculatorPage.vue'), meta: { title: 'Calculadora de frete' } },
      {
        path: 'relatorios',
        name: 'reports',
        component: () => import('@/pages/ReportsPage.vue'),
        meta: { title: 'Relatórios', permission: 'reports.view' },
      },
      { path: 'configuracoes', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { title: 'Configurações' } },
      { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue'), meta: { title: 'Página não encontrada' } },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · RotaCerta` : 'RotaCerta'
})
