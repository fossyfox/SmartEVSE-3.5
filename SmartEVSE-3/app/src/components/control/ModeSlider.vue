<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ModeId } from '@/lib/types'

interface ModeOption {
  id: ModeId
  label: string
}

const props = defineProps<{
  /** Currently active mode reported by the device. */
  modelValue: ModeId
  /** Visible options, in display order. */
  options: ModeOption[]
  /** Disables interaction while a write is in flight. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: ModeId): void
}>()

const track = ref<HTMLElement | null>(null)

// Index of the active option within the *visible* set; falls back to 0 if the
// active mode is hidden (e.g. SOLAR active but mains meter removed).
const activeIndex = computed(() => {
  const i = props.options.findIndex((o) => o.id === props.modelValue)
  return i === -1 ? 0 : i
})

// The sliding pill is positioned as a fraction of the track width.
const pillStyle = computed(() => {
  const n = props.options.length || 1
  return {
    width: `calc(${100 / n}% - 0.5rem)`,
    left: `calc(${(activeIndex.value / n) * 100}% + 0.25rem)`,
  }
})

function pick(id: ModeId) {
  if (props.disabled || id === props.modelValue) return
  emit('select', id)
}

// --- pointer drag -------------------------------------------------------
const dragging = ref(false)

function indexFromClientX(clientX: number): number {
  const el = track.value
  if (!el) return activeIndex.value
  const rect = el.getBoundingClientRect()
  const ratio = (clientX - rect.left) / rect.width
  const n = props.options.length
  return Math.min(n - 1, Math.max(0, Math.floor(ratio * n)))
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled) return
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pick(props.options[indexFromClientX(e.clientX)].id)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  pick(props.options[indexFromClientX(e.clientX)].id)
}

function onPointerUp(e: PointerEvent) {
  dragging.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

// Keyboard: arrow keys step between adjacent modes.
function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  let next = activeIndex.value
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next++
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next--
  else return
  e.preventDefault()
  next = Math.min(props.options.length - 1, Math.max(0, next))
  pick(props.options[next].id)
}
</script>

<template>
  <div
    ref="track"
    class="mode-slider"
    :class="{ 'is-disabled': disabled, 'is-dragging': dragging }"
    role="radiogroup"
    aria-label="Charging mode"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @keydown="onKeydown"
  >
    <!-- Sliding indicator pill -->
    <div class="mode-slider__pill" :style="pillStyle" aria-hidden="true" />

    <!-- Labels -->
    <button
      v-for="o in options"
      :key="o.id"
      type="button"
      class="mode-slider__opt"
      :class="{ 'is-active': o.id === modelValue }"
      role="radio"
      :aria-checked="o.id === modelValue"
      :disabled="disabled"
      tabindex="-1"
      @click="pick(o.id)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.mode-slider {
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 0;
  padding: 0.25rem;
  border-radius: 1rem;
  border: 1px solid rgb(255 255 255 / 0.1);
  background: rgb(2 6 23 / 0.55);
  box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.4);
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.mode-slider:focus-visible {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}

.mode-slider.is-dragging {
  cursor: grabbing;
}

.mode-slider.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* The pill that glides under the active label. */
.mode-slider__pill {
  position: absolute;
  top: 0.25rem;
  bottom: 0.25rem;
  border-radius: 0.75rem;
  background: var(--color-brand-600);
  box-shadow: 0 6px 16px -4px rgb(16 185 129 / 0.5);
  transition:
    left 0.28s cubic-bezier(0.34, 1.4, 0.5, 1),
    width 0.28s cubic-bezier(0.34, 1.4, 0.5, 1);
  pointer-events: none;
}

.mode-slider__opt {
  position: relative;
  z-index: 1;
  padding: 0.55rem 0.5rem;
  border: 0;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-slate-400);
  cursor: pointer;
  transition: color 0.2s;
}

.mode-slider__opt:hover:not(.is-active) {
  color: var(--color-slate-200);
}

.mode-slider__opt.is-active {
  color: #fff;
}

.mode-slider__opt:disabled {
  cursor: inherit;
}
</style>
