<script setup lang="ts">
import { computed } from 'vue'

import StatCard from '@/components/ui/StatCard.vue'
import StatRow from '@/components/ui/StatRow.vue'
import { fmtDeciAmps, fmtDutyCycle, fmtTemp, fmtUnix } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const s = computed(() => store.settings)

const hasModem = computed(() => {
  const m = s.value?.settings?.modem
  return m === 'Experiment' || m === 'QCA7000'
})
const loadbl = computed(() => s.value?.evse?.loadbl ?? 0)
const powerSharing = computed(() => {
  if (loadbl.value > 1) return `Slave Node ${loadbl.value - 1}`
  if (loadbl.value === 1) return 'Master'
  return null
})
const stateText = computed(() => {
  const base = s.value?.evse?.state ?? '—'
  const t = s.value?.evse?.solar_stop_timer ?? 0
  return t > 0 ? `${base} (Stopping in ${t}s)` : base
})
const error = computed(() => {
  const e = s.value?.evse?.error
  return e && e !== 'None' ? e : null
})
const rfid = computed(() => {
  const r = s.value?.evse?.rfid
  return r && r !== 'Not Installed' ? r : null
})
const repeat = computed(() => (s.value?.settings?.repeat === 1 ? 'Daily' : 'none'))
</script>

<template>
  <StatCard title="EVSE" accent="text-brand-400">
    <template #actions>
      <span
        class="chip"
        :class="
          s?.car_connected ? 'bg-brand-500/15 text-brand-400' : 'bg-slate-500/15 text-slate-300'
        "
      >
        {{ s?.car_connected ? 'Car connected' : 'No car' }}
      </span>
    </template>

    <StatRow label="Mode" :value="s?.mode" />
    <StatRow v-if="powerSharing" label="Power Sharing" :value="powerSharing" />
    <StatRow v-if="hasModem" label="Duty cycle" :value="fmtDutyCycle(s?.evse?.pwm)" />
    <StatRow label="State" :value="stateText" />
    <StatRow v-if="error" label="Error">
      <span class="text-rose-300">{{ error }}</span>
    </StatRow>
    <StatRow v-if="rfid" label="RFID" :value="rfid" />
    <StatRow label="Charge" :value="fmtDeciAmps(s?.settings?.charge_current)" />
    <StatRow label="Temp" :value="fmtTemp(s?.evse?.temp, s?.evse?.temp_max)" />
    <StatRow v-if="s?.mqtt" label="MQTT" :value="s.mqtt.status" />
    <StatRow v-if="loadbl === 0" label="Contactor 2" :value="s?.settings?.enable_C2" />
    <StatRow label="Start time" :value="fmtUnix(s?.settings?.starttime)" />
    <StatRow label="Stop time" :value="fmtUnix(s?.settings?.stoptime)" />
    <StatRow label="Repeat" :value="repeat" />
  </StatCard>
</template>
