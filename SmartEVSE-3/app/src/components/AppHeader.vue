<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import StatusBadge from '@/components/ui/StatusBadge.vue'
import { fmtAgo } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

// Two-way "is the mobile drawer open" flag, owned by App.vue.
const sidebarOpen = defineModel<boolean>('open', { default: false })

const store = useEvseStore()
const route = useRoute()

const panelOpen = ref(false)
const hostDraft = ref(store.host)
const rebooting = ref(false)

async function onReboot() {
  if (rebooting.value) return
  if (!confirm('Reboot the SmartEVSE now?')) return
  rebooting.value = true
  try {
    await store.reboot()
  } catch {
    /* device may already be restarting; nothing to surface */
  } finally {
    rebooting.value = false
  }
}

// Re-evaluate the "x ago" label on a ticking clock.
const now = ref(Date.now())
setInterval(() => (now.value = Date.now()), 1000)
const updatedLabel = computed(() => {
  void now.value
  return fmtAgo(store.lastUpdated)
})

const pageTitle = computed(() => route.meta.title ?? 'SmartEVSE')

function applyHost() {
  store.setHost(hostDraft.value)
  panelOpen.value = false
}

function togglePanel() {
  hostDraft.value = store.host
  panelOpen.value = !panelOpen.value
}

function togglePolling() {
  if (store.polling) store.pausePolling()
  else store.resumePolling()
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
    <div class="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
      <!-- Mobile menu toggle + page title -->
      <div class="flex items-center gap-3">
        <button
          class="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Open menu"
          @click="sidebarOpen = true"
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
          </svg>
        </button>
        <h1 class="text-base font-bold tracking-tight">{{ pageTitle }}</h1>
      </div>

      <div class="ml-auto flex items-center gap-2 sm:gap-3">
        <span class="hidden text-xs text-slate-400 sm:inline">updated {{ updatedLabel }}</span>
        <StatusBadge :status="store.status" />
        <button
          class="btn btn-sm"
          :title="store.polling ? 'Pause automatic polling' : 'Resume automatic polling'"
          :aria-pressed="!store.polling"
          @click="togglePolling"
        >
          <svg
            v-if="store.polling"
            viewBox="0 0 24 24"
            class="size-4"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          <svg v-else viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span class="hidden sm:inline">{{ store.polling ? 'Pause' : 'Resume' }}</span>
        </button>
        <button class="btn btn-sm" :disabled="!store.host && false" @click="store.refreshNow()">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M21 3v5h-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="hidden sm:inline">Refresh</span>
        </button>
        <button class="btn btn-sm" :class="{ 'btn-primary': panelOpen }" @click="togglePanel">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 6.9 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 6.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            />
          </svg>
          <span class="hidden sm:inline">Connection</span>
        </button>
        <button
          class="btn btn-sm btn-danger"
          :disabled="rebooting"
          title="Reboot the SmartEVSE"
          @click="onReboot"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M21 3v5h-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="hidden sm:inline">{{ rebooting ? 'Rebooting…' : 'Reboot' }}</span>
        </button>
      </div>
    </div>

    <!-- Connection panel -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="panelOpen" class="border-t border-white/10 bg-slate-900/80 backdrop-blur">
        <div class="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div class="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div>
              <label class="field-label" for="host">Device address</label>
              <input
                id="host"
                v-model="hostDraft"
                class="input"
                placeholder="SmartEVSE-1234.local or 192.168.1.50 (empty = same origin)"
                autocomplete="off"
                spellcheck="false"
                @keyup.enter="applyHost"
              />
            </div>
            <button class="btn btn-primary" @click="applyHost">Connect</button>
            <button class="btn" :disabled="store.detecting" @click="store.detect()">
              <span
                v-if="store.detecting"
                class="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              />
              {{ store.detecting ? 'Detecting…' : 'Auto-detect (mDNS)' }}
            </button>
          </div>
          <p class="mt-3 text-xs text-slate-400">
            <template v-if="store.polling">
              Currently polling <span class="font-semibold text-slate-200">{{ store.displayHost }}</span>
              every {{ Math.round(store.pollIntervalMs / 1000) }}s.
            </template>
            <template v-else>
              Polling <span class="font-semibold text-amber-300">paused</span> —
              <span class="font-semibold text-slate-200">{{ store.displayHost }}</span> won't refresh
              automatically. Use Resume or Refresh.
            </template>
            Auto-detect probes <code class="text-slate-300">SmartEVSE-&lt;serial&gt;.local</code> via your OS's mDNS resolver.
            Note: pointing at a device by IP/host requires CORS support or a proxy — see the README.
          </p>
          <p v-if="store.lastError" class="mt-2 text-xs text-rose-300">{{ store.lastError }}</p>
        </div>
      </div>
    </Transition>
  </header>
</template>
