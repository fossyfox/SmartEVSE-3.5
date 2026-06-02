<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { ApiError, fetchSettings } from '@/lib/api'
import { useEvseStore } from '@/stores/evse'

// A developer tool: fetch `/settings` straight from the device and show the raw
// JSON, independent of the store's polled copy. This deliberately bypasses the
// store so it works even before a connection is established (App.vue exempts the
// `raw` route from the first-connect prompt for the same reason).
const store = useEvseStore()

const raw = ref<string | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const copied = ref(false)

const pretty = computed(() => raw.value ?? '')

async function load() {
  loading.value = true
  error.value = null
  copied.value = false
  try {
    const data = await fetchSettings(store.origin)
    raw.value = JSON.stringify(data, null, 2)
  } catch (err) {
    raw.value = null
    error.value =
      err instanceof ApiError ? `${err.message} (${err.kind})` : (err as Error)?.message || 'Failed to fetch'
  } finally {
    loading.value = false
  }
}

async function copy() {
  if (!raw.value) return
  try {
    await navigator.clipboard.writeText(raw.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* clipboard unavailable (insecure context) — ignore */
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">Raw Data</h2>
        <p class="text-sm text-slate-400">
          The unparsed <code class="text-slate-300">/settings</code> JSON as the device reports it,
          fetched from <span class="text-slate-300">{{ store.displayHost }}</span>.
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm" :disabled="!raw" @click="copy">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
        <button class="btn btn-sm btn-primary" :disabled="loading" @click="load">
          {{ loading ? 'Fetching…' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/30 px-5 py-4 text-sm text-rose-300">
      {{ error }}
    </div>

    <div v-else-if="raw" class="card overflow-hidden">
      <pre class="overflow-x-auto px-5 py-4 text-xs leading-relaxed text-slate-200"><code>{{ pretty }}</code></pre>
    </div>

    <div v-else class="card px-6 py-10 text-center text-sm text-slate-400">
      {{ loading ? 'Fetching…' : 'No data.' }}
    </div>
  </div>
</template>
