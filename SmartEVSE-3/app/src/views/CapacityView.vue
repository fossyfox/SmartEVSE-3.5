<script setup lang="ts">
import CapacityPanel from '@/components/control/CapacityPanel.vue'
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold">Capacity</h2>
      <p class="text-sm text-slate-400">
        Limit the power drawn from the grid to stay under a capacity-tariff threshold, either as a
        fixed cap or on a time-based schedule.
      </p>
    </div>
    <CapacityPanel />
  </div>
</template>
