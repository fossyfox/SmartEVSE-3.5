<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useEvseStore } from '@/stores/evse'

// Two-way "is the mobile drawer open" flag, owned by App.vue.
const open = defineModel<boolean>('open', { default: false })

const store = useEvseStore()
const route = useRoute()

// In dev the app is served by Vite, not the device, so the firmware's Classic
// UI (/index.html) isn't reachable — following the link would just reload this
// SPA. Warn instead; the link works once the firmware is deployed on the device.
const isDev = import.meta.env.DEV

function onClassicUi(e: MouseEvent) {
  if (!isDev) return
  e.preventDefault()
  alert(
    "You're running the dev server for the new app. The Classic UI is served by " +
      'the device firmware, so it has no hot reloading and is unavailable here. ' +
      'It will work once firmware.bin is deployed on the device.',
  )
}

const serial = computed(() =>
  store.settings?.serialnr ? `SmartEVSE-${store.settings.serialnr}` : 'SmartEVSE (connecting)',
)

// Version-specific docs on GitHub, falling back to the master README.
const docsUrl = computed(() => {
  const v = store.settings?.version ?? ''
  const path = v.startsWith('v') ? v : 'master?tab=readme-ov-file'
  return `https://github.com/dingo35/SmartEVSE-3.5/tree/${path}#documentation`
})

// `icon` is inner SVG markup (stroke-based, 24×24). Item is either an in-app
// route (`name`) or an external link (`href`, opens in a new tab).
interface NavItem {
  name?: string
  href?: string
  label: string
  icon: string
}
interface NavGroup {
  heading: string
  items: NavItem[]
}

const groups = computed<NavGroup[]>(() => [
  {
    heading: 'Monitor',
    items: [
      {
        name: 'dashboard',
        label: 'Dashboard',
        icon: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
      },
      {
        name: 'stats',
        label: 'Charging Stats',
        icon: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 3 4-6"/>',
      },
    ],
  },
  {
    heading: 'Control',
    items: [
      {
        name: 'control',
        label: 'Schedule charge',
        icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      },
    ],
  },
  {
    heading: 'Integrations',
    items: [
      {
        name: 'mqtt',
        label: 'MQTT',
        icon: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/>',
      },
      {
        name: 'ocpp',
        label: 'OCPP',
        icon: '<path d="M9 8V2M15 8V2M12 22v-5"/><path d="M6 8h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/>',
      },
    ],
  },
  {
    heading: 'Grid settings',
    items: [
      {
        name: 'capacity',
        label: 'Capacity',
        icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
      },
    ],
  },
  {
    heading: 'System',
    items: [
      {
        name: 'firmware',
        label: 'Firmware',
        icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
      },
    ],
  },
])

function closeOnMobile() {
  open.value = false
}
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-slate-950/80 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
  >
    <!-- Brand -->
    <div class="flex h-16 items-center gap-3 border-b border-white/10 px-5">
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="flex min-w-0 items-center gap-3 rounded-lg transition hover:opacity-80"
        aria-label="Go to dashboard"
        @click="closeOnMobile"
      >
        <div
          class="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
            <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
          </svg>
        </div>
        <div class="min-w-0 leading-tight">
          <h1 class="truncate text-sm font-bold tracking-tight">{{ serial }}</h1>
        </div>
      </RouterLink>
      <button
        class="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
        aria-label="Close menu"
        @click="closeOnMobile"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      <div v-for="group in groups" :key="group.heading">
        <p class="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-500">
          {{ group.heading }}
        </p>
        <ul class="space-y-1">
          <li v-for="item in group.items" :key="item.label">
            <!-- External link (opens a device-hosted or off-app page) -->
            <a
              v-if="item.href"
              :href="item.href"
              target="_blank"
              rel="noopener"
              class="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              @click="closeOnMobile"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-5 shrink-0 text-slate-400 group-hover:text-slate-200"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="item.icon"
              />
              <span>{{ item.label }}</span>
              <svg
                viewBox="0 0 24 24"
                class="ml-auto size-3.5 text-slate-500 group-hover:text-slate-300"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
            <!-- In-app route -->
            <RouterLink
              v-else
              :to="{ name: item.name }"
              class="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition"
              :class="
                route.name === item.name
                  ? 'bg-brand-600/15 text-brand-300 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              "
              @click="closeOnMobile"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-5 shrink-0"
                :class="route.name === item.name ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                v-html="item.icon"
              />
              <span>{{ item.label }}</span>
              <span
                v-if="route.name === item.name"
                class="ml-auto size-1.5 rounded-full bg-brand-400"
              />
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Footer: docs + connection summary -->
    <div class="border-t border-white/10 px-4 py-4">
      <a
        :href="docsUrl"
        target="_blank"
        rel="noopener"
        class="group mb-3 flex items-center gap-2 px-1 text-xs font-medium text-slate-400 transition hover:text-slate-200"
      >
        <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span>Docs</span>
        <svg viewBox="0 0 24 24" class="ml-auto size-3.5 text-slate-500 group-hover:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
      <!-- Switch back to the device's legacy single-file UI (served at /index.html). -->
      <a
        href="/index.html"
        class="group mb-3 flex items-center gap-2 px-1 text-xs font-medium text-slate-400 transition hover:text-slate-200"
        @click="onClassicUi"
      >
        <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 5 5v6" />
        </svg>
        <span>Classic UI</span>
      </a>
      <div class="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-slate-400">Device</span>
          <StatusBadge :status="store.status" />
        </div>
        <p class="mt-1 truncate text-xs text-slate-300" :title="store.displayHost">
          {{ store.displayHost }}
        </p>
      </div>
    </div>
  </aside>
</template>
