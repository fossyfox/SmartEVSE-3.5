<script setup lang="ts">
import { computed } from 'vue'

import EvStateCard from '@/components/cards/EvStateCard.vue'
import EvseCard from '@/components/cards/EvseCard.vue'
import LcdCard from '@/components/cards/LcdCard.vue'
import ModeCard from '@/components/control/ModeCard.vue'
import { fmtDeciAmps, fmtKw, fmtTemp } from '@/lib/format'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const s = computed(() => store.settings)

// At-a-glance KPI tiles. `show` lets a tile drop out when its source is absent.
const kpis = computed(() => {
  const power = s.value?.ev_meter?.import_active_power
  return [
    { label: 'Mode', value: s.value?.mode ?? '—', accent: 'text-brand-400', show: true },
    {
      label: 'Charge current',
      value: fmtDeciAmps(s.value?.settings?.charge_current),
      accent: 'text-sky-400',
      show: true,
    },
    {
      label: 'Power',
      value: fmtKw(power),
      accent: 'text-amber-400',
      show: power != null,
    },
    {
      label: 'Temperature',
      value: fmtTemp(s.value?.evse?.temp),
      accent: 'text-rose-400',
      show: s.value?.evse?.temp != null,
    },
  ].filter((k) => k.show)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Mode control sits on top so the primary action is reachable first. -->
    <ModeCard />

    <!-- KPI strip -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div v-for="k in kpis" :key="k.label" class="card px-4 py-3.5">
        <p class="text-xs font-medium text-slate-400">{{ k.label }}</p>
        <p class="mt-1 text-xl font-bold tabular-nums" :class="k.accent">{{ k.value }}</p>
      </div>
    </div>

    <!-- Primary status + live display -->
    <div class="grid gap-6 lg:grid-cols-2">
      <EvseCard />
      <LcdCard />
    </div>

    <!-- EV battery state (shown only with a PLC modem) -->
    <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <EvStateCard />
    </div>
  </div>
</template>
