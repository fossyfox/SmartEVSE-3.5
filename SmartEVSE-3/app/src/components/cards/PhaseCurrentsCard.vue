<script setup lang="ts">
import StatCard from '@/components/ui/StatCard.vue'
import StatRow from '@/components/ui/StatRow.vue'
import { fmtDeciAmps } from '@/lib/format'
import type { PhaseCurrents } from '@/lib/types'

defineProps<{
  title: string
  accent?: string
  currents?: PhaseCurrents
}>()
</script>

<template>
  <StatCard :title="title" :accent="accent">
    <StatRow label="Total" :value="fmtDeciAmps(currents?.TOTAL)" />
    <StatRow label="L1" :value="fmtDeciAmps(currents?.L1)" />
    <StatRow label="L2" :value="fmtDeciAmps(currents?.L2)" />
    <StatRow label="L3" :value="fmtDeciAmps(currents?.L3)" />
    <slot />
  </StatCard>
</template>
