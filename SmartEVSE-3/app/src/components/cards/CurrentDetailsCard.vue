<script setup lang="ts">
import { computed } from 'vue'

import StatCard from '@/components/ui/StatCard.vue'
import StatRow from '@/components/ui/StatRow.vue'
import { fmtAmps, fmtDeciAmps } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const st = computed(() => store.settings?.settings)
</script>

<template>
  <StatCard title="Current Details" accent="text-sky-400">
    <StatRow label="Override" :value="fmtDeciAmps(st?.override_current)" />
    <StatRow label="Min" :value="fmtAmps(st?.current_min)" />
    <StatRow label="Max" :value="fmtAmps(st?.current_max)" />
  </StatCard>
</template>
