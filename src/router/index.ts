import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { Permission } from '@/types/domain'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import type { SkeletonVariant } from '@/components/skeleton/variants'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Permissão exigida para exibir a página (o backend também precisa validar). */
    permission?: Permission
    /** Item da navegação lateral que fica ativo nesta rota. */
    section?: string
    /** Tela de acesso: dispensa login e usa o layout sem barra administrativa. */
    public?: boolean
    /** Esqueleto exibido enquanto os dados carregam. */
    skeleton?: SkeletonVariant
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { skeleton: 'dashboard', title: 'Visão geral' } },
      { path: 'pedidos', name: 'orders', component: () => import('@/pages/OrdersPage.vue'), meta: { skeleton: 'list', title: 'Pedidos' } },
      {
        path: 'pedidos/novo',
        name: 'order-new',
        component: () => import('@/pages/OrderFormPage.vue'),
        meta: { skeleton: 'form', title: 'Novo pedido', section: 'orders', permission: 'orders.create' },
      },
      {
        path: 'pedidos/:id',
        name: 'order-detail',
        component: () => import('@/pages/OrderDetailPage.vue'),
        meta: { skeleton: 'detail', title: 'Pedido', section: 'orders' },
      },
      {
        path: 'pedidos/:id/editar',
        name: 'order-edit',
        component: () => import('@/pages/OrderFormPage.vue'),
        meta: { skeleton: 'form', title: 'Editar pedido', section: 'orders', permission: 'orders.edit' },
      },
      { path: 'despacho', name: 'dispatch', component: () => import('@/pages/DispatchPage.vue'), meta: { skeleton: 'list', title: 'Despacho' } },
      { path: 'mapa', name: 'map', component: () => import('@/pages/MapPage.vue'), meta: { skeleton: 'map', title: 'Mapa de entregas' } },
      { path: 'motoboys', name: 'couriers', component: () => import('@/pages/CouriersPage.vue'), meta: { skeleton: 'list', title: 'Motoboys' } },
      {
        path: 'motoboys/:id',
        name: 'courier-detail',
        component: () => import('@/pages/CourierDetailPage.vue'),
        meta: { skeleton: 'detail', title: 'Motoboy', section: 'couriers' },
      },
      { path: 'calculadora', name: 'calculator', component: () => import('@/pages/CalculatorPage.vue'), meta: { skeleton: 'form', title: 'Calculadora de frete' } },
      { path: 'qrcode-app', name: 'app-qrcode', component: () => import('@/pages/AppQrCodePage.vue'), meta: { skeleton: 'generic', title: 'QRCode para app' } },
      {
        path: 'relatorios',
        name: 'reports',
        component: () => import('@/pages/ReportsPage.vue'),
        meta: { skeleton: 'dashboard', title: 'Relatórios', permission: 'reports.view' },
      },
      { path: 'configuracoes', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { skeleton: 'settings', title: 'Configurações' } },
      { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue'), meta: { skeleton: 'generic', title: 'Página não encontrada' } },
    ],
  },
  {
    path: '/',
    component: AuthLayout,
    meta: { public: true },
    children: [
      { path: 'login', name: 'login', component: () => import('@/pages/auth/LoginPage.vue'), meta: { title: 'Entrar', public: true } },
      { path: 'cadastro', name: 'sign-up', component: () => import('@/pages/auth/SignUpPage.vue'), meta: { title: 'Criar conta', public: true } },
      { path: 'recuperar-senha', name: 'forgot-password', component: () => import('@/pages/auth/ForgotPasswordPage.vue'), meta: { title: 'Recuperar senha', public: true } },
      { path: 'area-entregador', name: 'courier-soon', component: () => import('@/pages/auth/CourierSoonPage.vue'), meta: { title: 'Área do entregador', public: true } },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

const ENTRY_ROUTES = ['login', 'sign-up', 'forgot-password']

/**
 * Guard de acesso. A decisão real de quem pode ver o quê é do backend; aqui apenas evitamos
 * mostrar telas administrativas sem sessão e levamos cada perfil ao destino que existe.
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ensureLoaded()
  const session = auth.session
  if (to.meta.public) {
    if (session?.role === 'establishment' && ENTRY_ROUTES.includes(String(to.name))) return { name: 'dashboard' }
    if (to.name === 'courier-soon' && session?.role !== 'courier') return { name: 'login', query: { perfil: 'entregador' } }
    return true
  }
  if (!session) return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  // Entregador ainda não tem painel: não o enviamos a rotas inexistentes.
  if (session.role === 'courier') return { name: 'courier-soon' }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · EasyEntregas` : 'EasyEntregas'
})
