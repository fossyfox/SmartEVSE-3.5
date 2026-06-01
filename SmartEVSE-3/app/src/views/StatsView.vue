<script setup lang="ts">
import CurrentDetailsCard from '@/components/cards/CurrentDetailsCard.vue'
import EvMeterCard from '@/components/cards/EvMeterCard.vue'
import EvMeterCurrentsCard from '@/components/cards/EvMeterCurrentsCard.vue'
import HomeBatteryCard from '@/components/cards/HomeBatteryCard.vue'
import MainsPhaseCard from '@/components/cards/MainsPhaseCard.vue'
import PhaseOriginalCard from '@/components/cards/PhaseOriginalCard.vue'
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold">Charging Stats</h2>
      <p class="text-sm text-slate-400">
        Live energy and per-phase current measurements. Cards appear as the relevant meters report
        data.
      </p>
    </div>

    <!-- Each card self-hides when its meter/section is absent. -->
    <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <CurrentDetailsCard />
      <EvMeterCard />
      <EvMeterCurrentsCard />
      <MainsPhaseCard />
      <PhaseOriginalCard />
      <HomeBatteryCard />
    </div>
  </div>
</template>
