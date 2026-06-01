<script setup lang="ts">
import { computed } from 'vue'

import StatCard from '@/components/ui/StatCard.vue'
import StatRow from '@/components/ui/StatRow.vue'
import { fmtKw, fmtKwh } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const m = computed(() => store.settings?.ev_meter)
const enabled = computed(() => !!m.value && m.value.description !== 'Disabled')
const host = computed(() => m.value?.host?.trim())
</script>

<template>
  <StatCard v-if="enabled" title="EV Meter" accent="text-amber-400">
    <StatRow label="Description" :value="m?.description" />
    <StatRow v-if="host" label="Hostname" :value="host" />
    <StatRow label="Power" :value="fmtKw(m?.import_active_power)" />
    <StatRow label="Total" :value="fmtKwh(m?.total_wh)" />
    <StatRow label="Charged" :value="fmtKwh(m?.charged_wh)" />
  </StatCard>
</template>
