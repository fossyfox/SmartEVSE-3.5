<script setup lang="ts">
import { computed } from 'vue'

import StatCard from '@/components/ui/StatCard.vue'
import StatRow from '@/components/ui/StatRow.vue'
import { fmtEta, fmtKwh, fmtMinsToGo, fmtSoc } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const ev = computed(() => store.settings?.ev_state)
</script>

<template>
  <StatCard v-if="ev" title="EV State" accent="text-sky-400">
    <StatRow label="EVCCID" :value="ev.evccid || 'N/A'" />
    <StatRow label="Current SoC" title="Estimated / computed" :value="fmtSoc(ev.computed_soc)" />
    <StatRow label="Initial SoC" :value="fmtSoc(ev.initial_soc)" />
    <StatRow label="Full SoC" :value="fmtSoc(ev.full_soc)" />
    <StatRow
      label="Est. full at"
      :title="fmtMinsToGo(ev.time_until_full)"
      :value="fmtEta(ev.time_until_full)"
    />
    <StatRow
      label="Capacity"
      :value="ev.energy_capacity != null && ev.energy_capacity >= 0 ? fmtKwh(ev.energy_capacity) : 'N/A'"
    />
  </StatCard>
</template>
