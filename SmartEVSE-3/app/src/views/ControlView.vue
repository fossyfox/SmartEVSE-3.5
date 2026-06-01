<script setup lang="ts">
import ControlPanel from '@/components/control/ControlPanel.vue'
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold">Schedule charge</h2>
      <p class="text-sm text-slate-400">
        Schedule a delayed start/stop and manage locks and overrides.
      </p>
    </div>
    <ControlPanel />
  </div>
</template>
