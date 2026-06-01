import { createRouter, createWebHashHistory } from 'vue-router'

// Per-route metadata surfaced in the header and sidebar.
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

// Hash history keeps deep links working when the bundle is served from the
// device, which has no SPA fallback for arbitrary paths.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      meta: { title: 'Dashboard' },
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/stats',
      name: 'stats',
      meta: { title: 'Charging Stats' },
      component: () => import('@/views/StatsView.vue'),
    },
    {
      path: '/control',
      name: 'control',
      meta: { title: 'Schedule charge' },
      component: () => import('@/views/ControlView.vue'),
    },
    {
      path: '/capacity',
      name: 'capacity',
      meta: { title: 'Capacity' },
      component: () => import('@/views/CapacityView.vue'),
    },
    {
      path: '/mqtt',
      name: 'mqtt',
      meta: { title: 'MQTT' },
      component: () => import('@/views/MqttView.vue'),
    },
    {
      path: '/ocpp',
      name: 'ocpp',
      meta: { title: 'OCPP' },
      component: () => import('@/views/OcppView.vue'),
    },
    {
      path: '/firmware',
      name: 'firmware',
      meta: { title: 'Firmware' },
      component: () => import('@/views/FirmwareView.vue'),
    },
    // Back-compat: the page used to be /system.
    { path: '/system', redirect: { name: 'firmware' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
