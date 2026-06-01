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
        {{ store.lastError || 'Set the device address or auto-detect via mDNS using the Connection button above.' }}
      </p>
      <div class="flex justify-center gap-2">
        <button class="btn btn-primary" :disabled="store.detecting" @click="store.detect()">
          {{ store.detecting ? 'Detecting…' : 'Auto-detect (mDNS)' }}
        </button>
        <button class="btn" @click="store.refreshNow()">Retry</button>
      </div>
    </div>
  </div>
</template>
