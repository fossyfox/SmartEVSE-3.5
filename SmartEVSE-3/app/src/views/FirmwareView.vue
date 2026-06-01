<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import { ApiError } from '@/lib/api'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const s = computed(() => store.settings)

const version = computed(() => s.value?.version ?? '—')
const serial = computed(() => (s.value?.serialnr ? `SmartEVSE-${s.value.serialnr}` : '—'))

// ------------------------------------------------------------------ //
// Latest releases — from the GitHub releases API (no auth, public).
// ------------------------------------------------------------------ //
interface Channel {
  /** State key and `owner` query param. */
  key: 'factory' | 'community'
  label: string
  status: string
  /** GitHub owner — also the `owner` value the firmware expects. */
  owner: string
  repo: string
}

const CHANNELS: Channel[] = [
  { key: 'factory', label: 'Factory', status: 'stable', owner: 'SmartEVSE', repo: 'SmartEVSE-3' },
  {
    key: 'community',
    label: 'Community',
    status: 'bleeding edge',
    owner: 'dingo35',
    repo: 'SmartEVSE-3.5',
  },
]

const latest = reactive<Record<string, string>>({})

async function loadLatest(): Promise<void> {
  await Promise.all(
    CHANNELS.map(async (c) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${c.owner}/${c.repo}/releases/latest`,
          { headers: { Accept: 'application/vnd.github+json' } },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { tag_name?: string }
        latest[c.key] = data.tag_name ?? '—'
      } catch {
        latest[c.key] = 'unavailable'
      }
    }),
  )
}
void loadLatest()

// ------------------------------------------------------------------ //
// Shared progress/flash state. Only one flash job runs at a time.
// ------------------------------------------------------------------ //
type Phase = 'idle' | 'running' | 'success' | 'error'

const phase = ref<Phase>('idle')
const message = ref('')
const sent = ref(0)
const total = ref(0)
/** Which control is busy, for per-button spinners. */
const activeJob = ref<string | null>(null)

const busy = computed(() => phase.value === 'running')
const percent = computed(() => {
  if (!total.value) return phase.value === 'running' ? 0 : 0
  return Math.min(100, Math.round((sent.value / total.value) * 100))
})
// Auto-update reports `progress` in bytes but no reliable total up front;
// show an indeterminate bar until we have one.
const indeterminate = computed(() => phase.value === 'running' && total.value === 0)

function resetProgress(job: string): void {
  phase.value = 'running'
  message.value = ''
  sent.value = 0
  total.value = 0
  activeJob.value = job
}

// ------------------------------------------------------------------ //
// Channel auto-update.
// ------------------------------------------------------------------ //
let pollTimer: ReturnType<typeof setTimeout> | null = null

function stopPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

async function runAutoUpdate(channel: Channel, debug: 0 | 1): Promise<void> {
  if (busy.value) return
  const job = `${channel.key}:${debug}`
  resetProgress(job)
  message.value = `Starting ${channel.label} update from GitHub…`
  try {
    const init = await store.startAutoUpdate(channel.owner, debug)
    applyAutoProgress(init)
    if (phase.value === 'running') scheduleAutoPoll()
  } catch (err) {
    fail(err)
  }
}

function scheduleAutoPoll(): void {
  stopPolling()
  pollTimer = setTimeout(async () => {
    try {
      const data = await store.pollAutoUpdate()
      applyAutoProgress(data)
      if (phase.value === 'running') scheduleAutoPoll()
    } catch (err) {
      fail(err)
    }
  }, 1000)
}

function applyAutoProgress(data: { progress: number; size: number }): void {
  if (data.progress === -1) {
    stopPolling()
    phase.value = 'success'
    sent.value = total.value
    message.value =
      'Firmware update completed. The device will reboot once no EV is connected.'
    return
  }
  if (data.progress === -2) {
    stopPolling()
    phase.value = 'error'
    message.value = 'Firmware update failed. The previous firmware is still active.'
    return
  }
  total.value = data.size > 0 ? data.size : 0
  sent.value = Math.max(0, data.progress)
  message.value =
    total.value > 0
      ? `Flashing… ${formatBytes(sent.value)} of ${formatBytes(total.value)}`
      : 'Downloading firmware from GitHub…'
}

// ------------------------------------------------------------------ //
// Custom file flashing — chunked POST /update.
// ------------------------------------------------------------------ //
const CHUNK_SIZE = 2048
const fileInput = ref<HTMLInputElement | null>(null)
const cancelled = ref(false)

// Uploads only work over plain HTTP — firmware can't handle the body on TLS.
const httpsWarning = computed(() => {
  const origin = store.origin || location.origin
  return origin.startsWith('https:')
})

function pickFile(): void {
  if (busy.value) return
  fileInput.value?.click()
}

async function onFileChosen(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file later
  if (!file || busy.value) return

  const buf = new Uint8Array(await file.arrayBuffer())
  resetProgress(`upload:${file.name}`)
  total.value = buf.length
  cancelled.value = false
  message.value = `Uploading ${file.name}…`

  // Suspend /settings polling for the duration: it would otherwise compete with
  // the chunk uploads for the device's tiny connection budget. stopPolling (not
  // pausePolling) keeps this transient — startPolling honours a real user pause.
  store.stopPolling()
  try {
    for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
      if (cancelled.value) {
        phase.value = 'error'
        message.value = 'Upload cancelled.'
        return
      }
      const chunk = buf.subarray(offset, offset + CHUNK_SIZE)
      const res = await store.uploadChunk({
        offset,
        file: file.name,
        size: buf.length,
        chunk,
      })
      if (!res.ok) {
        phase.value = 'error'
        message.value = `Error: ${res.text || 'upload rejected by device'}`
        return
      }
      sent.value = Math.min(buf.length, offset + chunk.length)
    }
    phase.value = 'success'
    sent.value = buf.length
    message.value = `Upload of ${file.name} finished. The device will reboot.`
  } catch (err) {
    fail(err)
  } finally {
    store.startPolling()
  }
}

function cancelUpload(): void {
  cancelled.value = true
}

// ------------------------------------------------------------------ //
// Helpers.
// ------------------------------------------------------------------ //
function fail(err: unknown): void {
  stopPolling()
  phase.value = 'error'
  if (err instanceof ApiError) {
    message.value =
      err.kind === 'timeout'
        ? 'The device did not respond in time.'
        : `Update failed (${err.message}).`
  } else {
    message.value = err instanceof Error ? err.message : 'Update failed.'
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function dismiss(): void {
  if (busy.value) return
  phase.value = 'idle'
  message.value = ''
  activeJob.value = null
  sent.value = 0
  total.value = 0
}

onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold">Firmware</h2>
      <p class="text-sm text-slate-400">
        Update over the air from a release channel, or flash a file you provide.
      </p>
    </div>

    <!-- Device summary -->
    <section class="card">
      <header class="card-head">
        <span class="size-2 rounded-full bg-brand-500" />
        <h2 class="card-title">Device</h2>
      </header>
      <div class="card-body">
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="field-label">Current firmware</dt>
            <dd class="text-lg font-bold tabular-nums text-slate-100">{{ version }}</dd>
          </div>
          <div>
            <dt class="field-label">Serial</dt>
            <dd class="text-lg font-bold text-slate-100">{{ serial }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- Progress banner -->
    <section
      v-if="phase !== 'idle'"
      class="card"
      :class="{
        'border-brand-500/40': phase === 'running' || phase === 'success',
        'border-rose-500/40': phase === 'error',
      }"
    >
      <div class="card-body space-y-3">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-2.5">
            <svg
              v-if="phase === 'running'"
              class="size-5 animate-spin text-brand-400"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-20" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
            </svg>
            <svg
              v-else-if="phase === 'success'"
              class="size-5 text-brand-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <svg
              v-else
              class="size-5 text-rose-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <p class="text-sm font-medium text-slate-200">{{ message }}</p>
          </div>
          <button
            v-if="phase === 'running' && activeJob?.startsWith('upload:')"
            class="btn btn-sm"
            @click="cancelUpload"
          >
            Cancel
          </button>
          <button v-else-if="phase !== 'running'" class="btn btn-sm" @click="dismiss">
            Dismiss
          </button>
        </div>

        <!-- Progress bar -->
        <div class="space-y-1.5">
          <div class="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full transition-[width] duration-300 ease-out"
              :class="[
                phase === 'error' ? 'bg-rose-500' : 'bg-brand-500',
                indeterminate ? 'w-2/5 animate-pulse' : '',
              ]"
              :style="indeterminate ? undefined : { width: `${percent}%` }"
            />
          </div>
          <div class="flex justify-between text-xs tabular-nums text-slate-400">
            <span>{{ indeterminate ? 'Working…' : `${percent}%` }}</span>
            <span v-if="total > 0">{{ formatBytes(sent) }} / {{ formatBytes(total) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Channel auto-update -->
    <section class="card">
      <header class="card-head">
        <span class="size-2 rounded-full bg-brand-500" />
        <h2 class="card-title">Update from channel</h2>
      </header>
      <div class="card-body space-y-3">
        <div
          v-for="c in CHANNELS"
          :key="c.key"
          class="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-slate-100">{{ c.label }}</span>
              <span class="chip bg-white/10 text-slate-300">{{ c.status }}</span>
            </div>
            <p class="mt-1 text-xs text-slate-400">
              Latest:
              <span class="font-medium tabular-nums text-slate-300">{{ latest[c.key] ?? '…' }}</span>
              ·
              <a
                class="text-brand-400 hover:underline"
                :href="`https://github.com/${c.owner}/${c.repo}/releases`"
                target="_blank"
                rel="noopener"
                >release notes</a
              >
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button
              class="btn btn-primary btn-sm"
              :disabled="busy"
              @click="runAutoUpdate(c, 0)"
            >
              <svg
                v-if="busy && activeJob === `${c.key}:0`"
                class="size-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-20" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
              Standard
            </button>
            <button class="btn btn-sm" :disabled="busy" @click="runAutoUpdate(c, 1)">
              <svg
                v-if="busy && activeJob === `${c.key}:1`"
                class="size-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-20" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
              Debug
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Custom flashing -->
    <section class="card">
      <header class="card-head">
        <span class="size-2 rounded-full bg-brand-500" />
        <h2 class="card-title">Custom flashing</h2>
      </header>
      <div class="card-body space-y-4 text-sm text-slate-300">
        <p>Flash one of the following, using these exact filenames:</p>
        <ul class="space-y-1.5">
          <li class="flex gap-2">
            <code class="rounded bg-white/10 px-1.5 py-0.5 text-xs text-brand-300"
              >firmware.bin</code
            >
            <span class="text-slate-400"
              >/ <code class="text-xs">firmware.signed.bin</code> — update the firmware</span
            >
          </li>
          <li class="flex gap-2">
            <code class="rounded bg-white/10 px-1.5 py-0.5 text-xs text-brand-300"
              >firmware.debug.bin</code
            >
            <span class="text-slate-400">— debug build, reachable over telnet</span>
          </li>
          <li class="flex gap-2">
            <code class="rounded bg-white/10 px-1.5 py-0.5 text-xs text-brand-300">rfid.txt</code>
            <span class="text-slate-400">— bulk-upload allowed NFC tags</span>
          </li>
        </ul>
        <p class="text-xs text-slate-500">
          No need to flash <code>spiffs.bin</code> on 3.6.0-RC1+. Signed firmware is verified as
          original on 3.6.2+.
        </p>

        <div
          v-if="httpsWarning"
          class="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200"
        >
          <svg
            class="mt-0.5 size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <span
            >File uploads only work over plain <strong>HTTP</strong> and will fail on an HTTPS
            connection to the device.</span
          >
        </div>

        <div class="pt-1">
          <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />
          <button class="btn btn-primary" :disabled="busy" @click="pickFile">
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Choose file…
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
