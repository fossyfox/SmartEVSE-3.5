<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ModeSlider from '@/components/control/ModeSlider.vue'
import SelectMenu from '@/components/ui/SelectMenu.vue'
import { MODE_LABELS, type ModeId } from '@/lib/types'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const s = computed(() => store.settings)

const busy = ref(false)

// Modes in slider order: OFF · PAUSE · NORMAL · SOLAR · SMART.
// mode_id mapping: 0 OFF, 1 NORMAL, 2 SOLAR, 3 SMART, 4 PAUSE.
const ALL_MODES: { id: ModeId; label: string }[] = [
  { id: 0, label: 'OFF' },
  { id: 4, label: 'PAUSE' },
  { id: 1, label: 'NORMAL' },
  { id: 2, label: 'SOLAR' },
  { id: 3, label: 'SMART' },
]

const activeMode = computed<ModeId>(() => (s.value?.mode_id ?? 0) as ModeId)
const loadbl = computed(() => s.value?.evse?.loadbl ?? 0)
const hasMainsMeter = computed(() => s.value?.settings?.mains_meter !== 'Disabled')
const isSolar = computed(() => activeMode.value === 2)

// SOLAR & SMART require a mains meter (or a load-balancing setup).
const modes = computed(() =>
  ALL_MODES.filter((m) => (m.id === 2 || m.id === 3 ? hasMainsMeter.value || loadbl.value > 0 : true)),
)

// --- override current ---------------------------------------------------
const overrideOptions = computed(() => {
  const min = Math.round(s.value?.settings?.current_min ?? 6)
  const max = Math.round(s.value?.settings?.current_max ?? 16)
  const opts = [{ value: 0, label: 'No override' }]
  for (let a = min; a <= max; a++) opts.push({ value: a, label: `${a} A` })
  return opts
})
const overrideCurrent = ref(0)
const showOverride = computed(() => loadbl.value < 2 && !isSolar.value)

watch(
  s,
  () => {
    if (overrideCurrent.value === 0 && s.value?.settings?.override_current) {
      overrideCurrent.value = Math.round((s.value.settings.override_current ?? 0) / 10)
    }
  },
  { immediate: true },
)

async function activate(mode: ModeId) {
  busy.value = true
  try {
    const params: Record<string, string | number> = { mode }
    if ([1, 2, 3].includes(mode)) params.override_current = overrideCurrent.value * 10
    await store.commit(params)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <span class="size-2 rounded-full bg-brand-500" />
      <h2 class="card-title">Control</h2>
      <span v-if="busy" class="ml-auto text-xs text-slate-400">working…</span>
    </header>

    <div class="card-body space-y-5">
      <!-- Mode -->
      <div>
        <div class="field-label">Mode</div>
        <ModeSlider
          :model-value="activeMode"
          :options="modes"
          :disabled="busy"
          @select="activate"
        />
        <p class="mt-2 text-xs text-slate-400">
          Active mode: <span class="font-semibold text-slate-200">{{ MODE_LABELS[activeMode] }}</span>
        </p>
      </div>

      <!-- Override current -->
      <div v-if="showOverride" class="max-w-xs">
        <label class="field-label" for="dash-override">Override current</label>
        <SelectMenu
          id="dash-override"
          v-model="overrideCurrent"
          :options="overrideOptions"
          aria-label="Override current"
        />
        <p class="mt-1 text-xs text-slate-500">Applied when you slide to NORMAL / SOLAR / SMART.</p>
      </div>
    </div>
  </section>
</template>
