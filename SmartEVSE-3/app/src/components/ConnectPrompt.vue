<script setup lang="ts">
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
</script>

<template>
  <div class="card grid place-items-center px-6 py-16 text-center">
    <div v-if="store.status === 'connecting'" class="space-y-3">
      <div class="mx-auto size-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-500" />
      <p class="text-sm text-slate-400">Connecting to {{ store.displayHost }}…</p>
    </div>
    <div v-else class="max-w-md space-y-3">
      <h2 class="text-lg font-semibold">No device connected</h2>
      <p class="text-sm text-slate-400">
        {{ store.lastError || `Could not reach ${store.displayHost}.` }}
      </p>
      <div class="flex justify-center gap-2">
        <button class="btn btn-primary" @click="store.refreshNow()">Retry</button>
      </div>
    </div>
  </div>
</template>
