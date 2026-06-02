<script setup lang="ts">
import { computed } from 'vue'

import type { ConnectionStatus } from '@/lib/types'

const props = withDefaults(
  defineProps<{
    status: ConnectionStatus
    /** Collapse to just the coloured dot below lg (used in the tight header). */
    collapse?: boolean
  }>(),
  { collapse: false },
)

const map: Record<ConnectionStatus, { label: string; classes: string; pulse: boolean }> = {
  idle: { label: 'Idle', classes: 'bg-slate-500/15 text-slate-300', pulse: false },
  connecting: { label: 'Connecting', classes: 'bg-amber-500/15 text-amber-300', pulse: true },
  connected: { label: 'Connected', classes: 'bg-brand-500/15 text-brand-400', pulse: false },
  error: { label: 'Offline', classes: 'bg-rose-500/15 text-rose-300', pulse: false },
}

const view = computed(() => map[props.status])
</script>

<template>
  <!-- When `collapse` is set this shrinks to just the coloured dot below lg
       (so the header stays on one line) and grows back into the full pill
       with its label from lg up. Without it, it's always the full pill. -->
  <span
    class="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold"
    :class="[view.classes, collapse ? 'lg:px-2.5 lg:py-1' : 'px-2.5 py-1']"
    :aria-label="view.label"
  >
    <span
      class="rounded-full bg-current"
      :class="[collapse ? 'size-2.5 lg:size-2' : 'size-2', { 'animate-pulse': view.pulse }]"
    />
    <span :class="collapse ? 'sr-only lg:not-sr-only' : ''">{{ view.label }}</span>
  </span>
</template>
