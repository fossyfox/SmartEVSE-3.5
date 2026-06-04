<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const s = computed(() => store.settings)

const busy = ref(false)

const activeMode = computed(() => s.value?.mode_id ?? 0)
const loadbl = computed(() => s.value?.evse?.loadbl ?? 0)
const hasModem = computed(() => {
  const m = s.value?.settings?.modem
  return m === 'Experiment' || m === 'QCA7000'
})
const isSolar = computed(() => activeMode.value === 2)

// --- scheduling ---------------------------------------------------------
function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const startTime = ref(nowLocal())
const stopTime = ref(nowLocal())
const dailyRepeat = ref(false)

async function applySchedule() {
  busy.value = true
  try {
    await store.commit({
      starttime: startTime.value,
      stoptime: stopTime.value,
      repeat: dailyRepeat.value ? 1 : 0,
    })
  } finally {
    busy.value = false
  }
}

// --- solar settings -----------------------------------------------------
const solarStart = ref(0)
const solarMaxImport = ref(0)
const solarStopTime = ref(0)
watch(
  s,
  () => {
    solarStart.value = s.value?.settings?.solar_start_current ?? 0
    solarMaxImport.value = s.value?.settings?.solar_max_import ?? 0
    solarStopTime.value = s.value?.settings?.solar_stop_time ?? 0
  },
  { immediate: true },
)

const setSolarStart = () => store.commit({ solar_start_current: solarStart.value })
const setSolarImport = () => store.commit({ solar_max_import: solarMaxImport.value })
const setSolarStop = () => store.commit({ stop_timer: solarStopTime.value })

// --- locks --------------------------------------------------------------
const showCableLock = computed(() => (s.value?.settings?.lock ?? 0) !== 0)
const cableLock = computed({
  get: () => s.value?.settings?.cablelock === 1,
  set: (v) => void store.commit({ cablelock: v ? 1 : 0 }),
})

// --- PWM override -------------------------------------------------------
const pwmDisabled = computed(() => loadbl.value > 1)
const pwmButtons = [
  { label: '0%', value: 0 },
  { label: '5%', value: 50 },
  { label: '100%', value: 1024 },
  { label: 'Reset', value: -1 },
]
const setPwm = (v: number) => store.commit({ override_pwm: v })

// --- autocharge ---------------------------------------------------------
const requiredEvccid = ref('')
watch(
  () => s.value?.settings?.required_evccid,
  (v) => {
    if (v != null) requiredEvccid.value = v
  },
  { immediate: true },
)
const setEvccid = () => store.commit({ required_evccid: requiredEvccid.value })
</script>

<template>
  <section class="card">
    <header class="card-head">
      <span class="size-2 rounded-full bg-brand-500" />
      <h2 class="card-title">Schedule charge</h2>
      <span v-if="busy" class="ml-auto text-xs text-slate-400">working…</span>
    </header>

    <div class="card-body space-y-6">
      <!-- Solar settings -->
      <div v-if="isSolar" class="grid gap-3 sm:grid-cols-3">
        <div>
          <label class="field-label" for="solar_start">Start current (A)</label>
          <input id="solar_start" v-model.number="solarStart" type="number" min="0" max="16" class="input" @change="setSolarStart" />
        </div>
        <div>
          <label class="field-label" for="solar_import">Max import (A)</label>
          <input id="solar_import" v-model.number="solarMaxImport" type="number" min="0" max="16" class="input" @change="setSolarImport" />
        </div>
        <div>
          <label class="field-label" for="solar_stop">Stop time (min)</label>
          <input id="solar_stop" v-model.number="solarStopTime" type="number" min="0" class="input" @change="setSolarStop" />
        </div>
      </div>

      <!-- Schedule -->
      <div>
        <div class="field-label">Delayed start / stop</div>
        <div class="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div class="min-w-0">
            <label class="field-label" for="starttime">Start</label>
            <input id="starttime" v-model="startTime" type="datetime-local" class="input" />
          </div>
          <div class="min-w-0">
            <label class="field-label" for="stoptime">End</label>
            <input id="stoptime" v-model="stopTime" type="datetime-local" class="input" />
          </div>
          <ToggleSwitch v-model="dailyRepeat" label="Repeat daily" />
        </div>
        <button type="button" class="btn btn-primary mt-3" :disabled="busy" @click="applySchedule">
          Apply schedule
        </button>
      </div>

      <!-- Locks -->
      <div v-if="showCableLock" class="flex flex-wrap items-center gap-6 border-t border-white/5 pt-5">
        <ToggleSwitch v-model="cableLock" label="Cable Lock" />
      </div>

      <!-- PWM override -->
      <div v-if="hasModem">
        <div class="field-label">Override PWM</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in pwmButtons"
            :key="p.value"
            type="button"
            class="btn"
            :disabled="busy || pwmDisabled"
            @click="setPwm(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <!-- Autocharge -->
      <div v-if="hasModem" class="max-w-md">
        <label class="field-label" for="evccid">Autocharge — required EVCCID</label>
        <div class="flex gap-2">
          <input id="evccid" v-model="requiredEvccid" class="input" placeholder="EVCCID to require" />
          <button type="button" class="btn" :disabled="busy" @click="setEvccid">Update</button>
        </div>
      </div>
    </div>
  </section>
</template>
