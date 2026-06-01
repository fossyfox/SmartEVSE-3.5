<script setup lang="ts">
import { computed } from 'vue'

import StatCard from '@/components/ui/StatCard.vue'
import StatRow from '@/components/ui/StatRow.vue'
import { fmtDeciAmps, fmtUnixDate, fmtUnixTime } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const b = computed(() => store.settings?.home_battery)
const enabled = computed(() => (b.value?.last_update ?? 0) > 0)
const statusText = computed(() => {
  const c = b.value?.current ?? 0
  if (c === 0) return 'Idle'
  return c < 0 ? 'Discharging' : 'Charging'
})
</script>

<template>
  <StatCard v-if="enabled" title="Home Battery" accent="text-amber-400">
    <StatRow label="Status" :value="statusText" />
    <StatRow label="Current" :value="fmtDeciAmps(b?.current)" />
    <StatRow label="Date" :value="fmtUnixDate(b?.last_update)" />
    <StatRow label="Time" :value="fmtUnixTime(b?.last_update)" />
  </StatCard>
</template>
