<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import ConnectPrompt from '@/components/ConnectPrompt.vue'
import DemoBanner from '@/components/DemoBanner.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const route = useRoute()

const isDemo = Boolean(import.meta.env.VITE_DEMO)
const sidebarOpen = ref(false)

// First-connect / empty state. The Raw Data view fetches independently and
// renders its own status, so it bypasses the prompt.
const showPrompt = computed(() => store.settings === null && route.name !== 'raw')

function onVisibility() {
  // Don't resurrect a paused poller when the tab regains focus.
  if (document.visibilityState === 'visible' && store.polling) void store.refreshNow()
}

onMounted(() => {
  store.startPolling()
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  store.stopPolling()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="min-h-dvh">
    <AppSidebar v-model:open="sidebarOpen" />

    <!-- Mobile drawer backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <div class="lg:pl-64">
      <DemoBanner v-if="isDemo" />
      <AppHeader v-model:open="sidebarOpen" />
      <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <ConnectPrompt v-if="showPrompt" />
        <RouterView v-else />
      </main>
      <footer class="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-600 sm:px-6">
        SmartEVSE Deluxe UI · polling {{ store.displayHost }}
      </footer>
    </div>
  </div>
</template>
