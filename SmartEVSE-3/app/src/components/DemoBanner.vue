<script setup lang="ts">
import { ref } from 'vue'

// Shown only in the demo build (App.vue gates on import.meta.env.VITE_DEMO).
const DISMISS_KEY = 'smartevse.demoBannerDismissed'
const dismissed = ref(localStorage.getItem(DISMISS_KEY) === '1')

function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* storage unavailable — banner just reappears next load */
  }
}
</script>

<template>
  <div
    v-if="!dismissed"
    class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-brand-500/30 bg-brand-500/10 px-4 py-2 text-center text-xs text-brand-200"
  >
    <span>
      <strong class="font-semibold text-brand-100">Demo</strong> — there is no real
      SmartEVSE. The dashboard, controls, LCD stream (PIN
      <span class="font-mono">1234</span>) and firmware flow are all simulated values.
    </span>
    <a
      href="https://github.com/fossyfox/SmartEVSE-3.5"
      target="_blank"
      rel="noopener"
      class="font-semibold text-brand-300 underline underline-offset-2 hover:text-brand-100"
    >
      Source on GitHub →
    </a>
    <button
      type="button"
      class="ml-2 rounded px-1.5 py-0.5 text-brand-300 hover:bg-white/10 hover:text-white"
      aria-label="Dismiss demo notice"
      @click="dismiss"
    >
      ✕
    </button>
  </div>
</template>
