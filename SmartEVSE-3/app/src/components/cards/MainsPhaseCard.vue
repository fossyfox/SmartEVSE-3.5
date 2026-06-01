<script setup lang="ts">
import { computed } from 'vue'

import PhaseCurrentsCard from '@/components/cards/PhaseCurrentsCard.vue'
import StatRow from '@/components/ui/StatRow.vue'
import { fmtUnixDate, fmtUnixTime } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const s = computed(() => store.settings)
const enabled = computed(() => s.value?.settings?.mains_meter !== 'Disabled')
const phases = computed(() => s.value?.phase_currents)
const host = computed(() => s.value?.mains_meter?.host?.trim())
</script>

<template>
  <PhaseCurrentsCard
    v-if="enabled"
    title="Mains Phases"
    accent="text-emerald-400"
    :currents="phases"
  >
    <StatRow
      v-if="(phases?.last_data_update ?? 0) > 0"
      label="Date"
      :value="fmtUnixDate(phases?.last_data_update)"
    />
    <StatRow
      v-if="(phases?.last_data_update ?? 0) > 0"
      label="Time"
      :value="fmtUnixTime(phases?.last_data_update)"
    />
    <StatRow v-if="host" label="Hostname" :value="host" />
  </PhaseCurrentsCard>
</template>
