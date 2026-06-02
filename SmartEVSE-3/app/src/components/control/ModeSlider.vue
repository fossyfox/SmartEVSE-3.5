<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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

// The pill hugs the active label's text (plus a little breathing room) instead
// of filling its whole equal-width column, so a short word like OFF gets a
// small pill and NORMAL a wider one. Measured from the live DOM so it stays
// correct across font sizes and container widths.
const pill = ref({ left: 0, width: 0 })
const ready = ref(false)

function measure() {
  const el = track.value
  if (!el) return
  const buttons = el.querySelectorAll<HTMLElement>('.mode-slider__opt')
  const btn = buttons[activeIndex.value]
  if (!btn) return
  const label = btn.querySelector<HTMLElement>('.mode-slider__label')
  const padX = 14 // breathing room on each side of the text
  const textWidth = label ? label.offsetWidth : btn.offsetWidth
  // Never wider than the column (keeps short screens from overflowing).
  const width = Math.min(textWidth + padX * 2, btn.offsetWidth)
  const center = btn.offsetLeft + btn.offsetWidth / 2
  pill.value = { left: center - width / 2, width }
}

const pillStyle = computed(() => ({
  width: `${pill.value.width}px`,
  transform: `translateX(${pill.value.left}px)`,
}))

let ro: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    measure()
    // Enable the sliding transition only after the first (instant) placement,
    // so the pill doesn't animate in from the left edge on mount.
    requestAnimationFrame(() => (ready.value = true))
  })
  if (typeof ResizeObserver !== 'undefined' && track.value) {
    ro = new ResizeObserver(() => measure())
    ro.observe(track.value)
  }
  // Web fonts can shift text metrics after first paint.
  document.fonts?.ready.then(() => measure())
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

// Re-place the pill when the active mode or the visible option set changes.
watch([activeIndex, () => props.options.map((o) => o.id).join('|')], () => nextTick(measure))

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
    <div class="mode-slider__pill" :class="{ 'is-ready': ready }" :style="pillStyle" aria-hidden="true" />

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
      <span class="mode-slider__label">{{ o.label }}</span>
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

/* The pill that glides under the active label; sized to hug its text. */
.mode-slider__pill {
  position: absolute;
  left: 0;
  top: 0.25rem;
  bottom: 0.25rem;
  border-radius: 0.75rem;
  background: var(--color-brand-600);
  box-shadow: 0 6px 16px -4px rgb(16 185 129 / 0.5);
  pointer-events: none;
}

.mode-slider__pill.is-ready {
  transition:
    transform 0.28s cubic-bezier(0.34, 1.4, 0.5, 1),
    width 0.28s cubic-bezier(0.34, 1.4, 0.5, 1);
}

.mode-slider__opt {
  position: relative;
  z-index: 1;
  padding: 0.45rem 0.375rem;
  border: 0;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-slate-400);
  cursor: pointer;
  transition: color 0.2s;
}

.mode-slider__label {
  display: inline-block;
}

/* Roomier type on tablets/desktop where the track is wider. */
@media (min-width: 640px) {
  .mode-slider__opt {
    padding: 0.55rem 0.5rem;
    font-size: 0.875rem;
    letter-spacing: 0.04em;
  }
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
