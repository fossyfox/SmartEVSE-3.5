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

function togglePolling() {
  if (store.polling) store.pausePolling()
  else store.resumePolling()
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
    <!-- 4rem minus the header's own 1px bottom border, so this bar totals 64px
         and its divider lines up with the sidebar's h-16 brand row. -->
    <div class="mx-auto flex min-h-[calc(4rem_-_1px)] max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
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
        <h1 class="text-sm font-bold tracking-tight lg:text-base">{{ pageTitle }}</h1>
      </div>

      <div class="ml-auto flex items-center gap-2 sm:gap-3">
        <span class="hidden text-xs text-slate-400 lg:inline">updated {{ updatedLabel }}</span>
        <StatusBadge :status="store.status" collapse />
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
          <span class="hidden lg:inline">{{ store.polling ? 'Pause' : 'Resume' }}</span>
        </button>
        <button class="btn btn-sm" :disabled="!store.host && false" @click="store.refreshNow()">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M21 3v5h-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="hidden lg:inline">Refresh</span>
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
          <span class="hidden lg:inline">{{ rebooting ? 'Rebooting…' : 'Reboot' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>
