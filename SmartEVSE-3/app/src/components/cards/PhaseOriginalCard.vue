<script setup lang="ts">
import { computed } from 'vue'

import PhaseCurrentsCard from '@/components/cards/PhaseCurrentsCard.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const original = computed(() => store.settings?.phase_currents?.original_data)
</script>

<template>
  <PhaseCurrentsCard
    v-if="original"
    title="Phases (Original)"
    accent="text-emerald-400"
    :currents="original"
  />
</template>
