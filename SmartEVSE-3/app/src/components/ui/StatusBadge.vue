<script setup lang="ts">
import { computed } from 'vue'

import type { ConnectionStatus } from '@/lib/types'

const props = defineProps<{ status: ConnectionStatus }>()

const map: Record<ConnectionStatus, { label: string; classes: string; pulse: boolean }> = {
  idle: { label: 'Idle', classes: 'bg-slate-500/15 text-slate-300', pulse: false },
  connecting: { label: 'Connecting', classes: 'bg-amber-500/15 text-amber-300', pulse: true },
  connected: { label: 'Connected', classes: 'bg-brand-500/15 text-brand-400', pulse: false },
  error: { label: 'Offline', classes: 'bg-rose-500/15 text-rose-300', pulse: false },
}

const view = computed(() => map[props.status])
</script>

<template>
  <span class="chip" :class="view.classes">
    <span
      class="size-2 rounded-full bg-current"
      :class="{ 'animate-pulse': view.pulse }"
    />
    {{ view.label }}
  </span>
</template>
