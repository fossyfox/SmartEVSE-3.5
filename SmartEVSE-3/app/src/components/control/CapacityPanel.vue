<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useEvseStore } from '@/stores/evse'
import type { CapacityInterval } from '@/lib/types'

const store = useEvseStore()
const s = computed(() => store.settings)

const busy = ref(false)

// --- capacity mode ------------------------------------------------------
// 0 Disabled · 1 Fixed · 2 Interval · 3 Flanders (matches firmware).
const CAPACITY_MODES = [
  { value: 0, label: 'Disabled' },
  { value: 1, label: 'Fixed' },
  { value: 2, label: 'Interval' },
  { value: 3, label: 'Flanders' },
]
const capacityMode = computed<number>(() => s.value?.settings?.capacity_mode ?? 0)
const isInterval = computed(() => capacityMode.value === 2)
const isFixed = computed(() => capacityMode.value === 1)

async function setCapacityMode(e: Event) {
  const mode = Number((e.target as HTMLSelectElement).value)
  busy.value = true
  try {
    await store.commit({ capacity_mode: mode })
  } finally {
    busy.value = false
  }
}

// --- fixed: max sum mains ----------------------------------------------
const maxSumMains = ref(0)
watch(
  () => s.value?.settings?.current_max_sum_mains,
  (v) => {
    if (v != null) maxSumMains.value = v
  },
  { immediate: true },
)
async function setMaxSumMains() {
  const val = maxSumMains.value
  if (isNaN(val) || val < 10 || val > 600) {
    error.value = 'Max Sum Mains must be between 10 and 600 A.'
    return
  }
  error.value = null
  busy.value = true
  try {
    await store.commit({ current_max_sum_mains: val })
  } finally {
    busy.value = false
  }
}

// --- interval list ------------------------------------------------------
// Local copy of the device's interval array; device replaces it wholesale each
// poll, so we mirror it and write the whole array back on every change.
const intervals = ref<CapacityInterval[]>([])
watch(
  () => s.value?.settings?.intervals,
  (v) => {
    if (Array.isArray(v)) intervals.value = [...v]
  },
  { immediate: true },
)

const error = ref<string | null>(null)

// Form state. `editIndex` of -1 means "adding new".
const startTime = ref('')
const powerLimit = ref<number | null>(null)
const editIndex = ref(-1)
const isEditing = computed(() => editIndex.value >= 0)

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, '0')
  const m = (min % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/** Persist the whole interval array; the firmware expects a JSON string. */
async function saveIntervals() {
  busy.value = true
  try {
    await store.commit({ intervals: JSON.stringify(intervals.value) })
  } finally {
    busy.value = false
  }
}

function resetForm() {
  startTime.value = ''
  powerLimit.value = null
  editIndex.value = -1
  error.value = null
}

async function submitInterval() {
  if (!startTime.value || powerLimit.value == null || isNaN(powerLimit.value)) {
    error.value = 'Please select a time and enter a valid power value.'
    return
  }
  const [hour, minute] = startTime.value.split(':').map(Number)
  if (isNaN(hour) || isNaN(minute)) {
    error.value = 'Please select a valid time.'
    return
  }
  const startMinutes = hour * 60 + minute

  const duplicate = intervals.value.some(
    (it, i) => it.start === startMinutes && i !== editIndex.value,
  )
  if (duplicate) {
    error.value = 'An interval already exists at this exact start time.'
    return
  }

  const entry: CapacityInterval = { start: startMinutes, power: Math.trunc(powerLimit.value) }
  const next = [...intervals.value]
  if (editIndex.value >= 0) next[editIndex.value] = entry
  else next.push(entry)
  next.sort((a, b) => a.start - b.start)
  intervals.value = next

  resetForm()
  await saveIntervals()
}

function editInterval(index: number) {
  const item = intervals.value[index]
  startTime.value = minutesToHHMM(item.start)
  powerLimit.value = item.power
  editIndex.value = index
  error.value = null
}

async function deleteInterval(index: number) {
  if (!confirm('Delete this interval?')) return
  intervals.value = intervals.value.filter((_, i) => i !== index)
  if (editIndex.value === index) resetForm()
  await saveIntervals()
}

async function clearAllIntervals() {
  if (!confirm('Clear ALL intervals? This cannot be undone.')) return
  intervals.value = []
  resetForm()
  await saveIntervals()
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <span class="size-2 rounded-full bg-brand-500" />
      <h2 class="card-title">Capacity</h2>
      <span v-if="busy" class="ml-auto text-xs text-slate-400">working…</span>
    </header>

    <div class="card-body space-y-6">
      <p class="text-sm text-slate-400">
        Only enable this if your electricity provider charges a capacity-limit rate — a higher
        tariff when you exceed a certain kW over a time window. This limits that capacity. It
        requires your MainsMeter to feed energy (kWh) data to the SmartEVSE.
      </p>

      <div v-if="error" class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
        {{ error }}
      </div>

      <!-- Capacity mode -->
      <div class="max-w-xs">
        <label class="field-label" for="capacity_mode">Capacity Mode</label>
        <select
          id="capacity_mode"
          class="input"
          :value="capacityMode"
          :disabled="busy"
          @change="setCapacityMode"
        >
          <option v-for="m in CAPACITY_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>

      <!-- Fixed: max sum mains -->
      <div v-if="isFixed" class="max-w-xs">
        <label class="field-label" for="max_sum_mains">Max Sum Mains (A)</label>
        <div class="flex gap-2">
          <input
            id="max_sum_mains"
            v-model.number="maxSumMains"
            type="number"
            min="10"
            max="600"
            step="1"
            class="input"
          />
          <button type="button" class="btn" :disabled="busy" @click="setMaxSumMains">Save</button>
        </div>
      </div>

      <!-- Interval: editor + list -->
      <div v-if="isInterval" class="grid gap-6 lg:grid-cols-5">
        <!-- Add / edit form -->
        <form class="lg:col-span-2 space-y-4" @submit.prevent="submitInterval">
          <h3 class="text-sm font-semibold text-slate-200">
            {{ isEditing ? 'Edit Power Limit Interval' : 'Add Power Limit Interval' }}
          </h3>
          <div>
            <label class="field-label" for="start_time">
              Start Time
              <span class="ml-1 text-slate-500">(active until the next interval)</span>
            </label>
            <input id="start_time" v-model="startTime" type="time" class="input" required />
          </div>
          <div>
            <label class="field-label" for="power_limit">Max Power (W)</label>
            <input
              id="power_limit"
              v-model.number="powerLimit"
              type="number"
              min="0"
              max="32000"
              step="100"
              placeholder="e.g. 6000"
              class="input"
              required
            />
          </div>
          <div class="flex justify-end gap-2">
            <button
              v-if="isEditing"
              type="button"
              class="btn"
              :disabled="busy"
              @click="resetForm"
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="busy">
              {{ isEditing ? 'Update Interval' : 'Add Interval' }}
            </button>
          </div>
        </form>

        <!-- Configured intervals -->
        <div class="lg:col-span-3 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-200">Configured Intervals</h3>
            <button
              v-if="intervals.length"
              type="button"
              class="btn btn-sm btn-danger"
              :disabled="busy"
              @click="clearAllIntervals"
            >
              Clear All
            </button>
          </div>

          <div
            v-if="!intervals.length"
            class="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400"
          >
            No intervals defined yet.<br />
            Use the form to add time-based power limits.
          </div>

          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th class="py-2 font-semibold">Start</th>
                <th class="py-2 font-semibold">Max Power</th>
                <th class="py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(interval, index) in intervals"
                :key="interval.start"
                class="border-b border-white/5 last:border-0"
              >
                <td class="py-2 tabular-nums text-slate-200">{{ minutesToHHMM(interval.start) }}</td>
                <td class="py-2 tabular-nums text-slate-200">{{ interval.power.toLocaleString() }} W</td>
                <td class="py-2">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="btn btn-sm"
                      :disabled="busy"
                      @click="editInterval(index)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-danger"
                      :disabled="busy"
                      @click="deleteInterval(index)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
