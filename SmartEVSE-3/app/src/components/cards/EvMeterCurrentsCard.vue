<script setup lang="ts">
import { computed } from 'vue'

import PhaseCurrentsCard from '@/components/cards/PhaseCurrentsCard.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const m = computed(() => store.settings?.ev_meter)
const enabled = computed(() => !!m.value && m.value.description !== 'Disabled')
</script>

<template>
  <PhaseCurrentsCard
    v-if="enabled"
    title="EV Meter Currents"
    accent="text-amber-400"
    :currents="m?.currents"
  />
</template>
