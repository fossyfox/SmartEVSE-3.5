<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

interface Option {
  value: string | number
  label: string
}

const props = defineProps<{
  options: Option[]
  disabled?: boolean
  id?: string
  ariaLabel?: string
  placeholder?: string
}>()

const model = defineModel<string | number | null>({ default: null })

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)

// The menu is teleported to <body> (so card backdrop-blur stacking contexts
// can't clip or cover it), positioned with these fixed-viewport coords.
const menuStyle = ref<Record<string, string>>({})

const selectedIndex = computed(() => props.options.findIndex((o) => o.value === model.value))
const selectedLabel = computed(
  () => props.options[selectedIndex.value]?.label ?? props.placeholder ?? 'Select…',
)

const MAX_MENU_HEIGHT = 256 // px, matches the old max-h-64

function updatePosition() {
  const el = triggerEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const gap = 6
  const spaceBelow = window.innerHeight - r.bottom
  const spaceAbove = r.top
  const openUp = spaceBelow < Math.min(MAX_MENU_HEIGHT, 220) && spaceAbove > spaceBelow
  const room = (openUp ? spaceAbove : spaceBelow) - gap - 8
  menuStyle.value = {
    position: 'fixed',
    left: `${Math.round(r.left)}px`,
    width: `${Math.round(r.width)}px`,
    maxHeight: `${Math.round(Math.max(120, Math.min(MAX_MENU_HEIGHT, room)))}px`,
    ...(openUp
      ? { bottom: `${Math.round(window.innerHeight - r.top + gap)}px` }
      : { top: `${Math.round(r.bottom + gap)}px` }),
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = menuEl.value?.children[activeIndex.value] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function openMenu() {
  if (props.disabled) return
  updatePosition()
  open.value = true
  activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0
  scrollActiveIntoView()
}

function closeMenu() {
  open.value = false
}

function choose(i: number) {
  const opt = props.options[i]
  if (!opt) return
  model.value = opt.value
  closeMenu()
  triggerEl.value?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (!open.value) return openMenu()
      activeIndex.value = Math.min(props.options.length - 1, activeIndex.value + 1)
      scrollActiveIntoView()
      break
    case 'ArrowUp':
      e.preventDefault()
      if (!open.value) return openMenu()
      activeIndex.value = Math.max(0, activeIndex.value - 1)
      scrollActiveIntoView()
      break
    case 'Home':
      if (open.value) {
        e.preventDefault()
        activeIndex.value = 0
        scrollActiveIntoView()
      }
      break
    case 'End':
      if (open.value) {
        e.preventDefault()
        activeIndex.value = props.options.length - 1
        scrollActiveIntoView()
      }
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (open.value) choose(activeIndex.value)
      else openMenu()
      break
    case 'Escape':
      if (open.value) {
        e.preventDefault()
        closeMenu()
      }
      break
    case 'Tab':
      closeMenu()
      break
  }
}

function onDocPointerDown(e: PointerEvent) {
  const t = e.target as Node
  if (rootEl.value?.contains(t) || menuEl.value?.contains(t)) return
  closeMenu()
}

function onReposition() {
  updatePosition()
}

watch(open, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onDocPointerDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown)
    window.removeEventListener('resize', onReposition)
    window.removeEventListener('scroll', onReposition, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  window.removeEventListener('resize', onReposition)
  window.removeEventListener('scroll', onReposition, true)
})
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      :id="id"
      ref="triggerEl"
      type="button"
      class="input flex w-full items-center justify-between gap-2 text-left"
      :class="open ? 'border-brand-500 ring-2 ring-brand-500/40' : ''"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      @click="open ? closeMenu() : openMenu()"
      @keydown="onKeydown"
    >
      <span class="truncate" :class="selectedIndex < 0 ? 'text-slate-500' : ''">{{
        selectedLabel
      }}</span>
      <svg
        class="size-4 shrink-0 text-slate-400 transition-transform"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m6 8 4 4 4-4" />
      </svg>
    </button>

    <Teleport to="body">
      <transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <ul
          v-if="open"
          ref="menuEl"
          role="listbox"
          :style="menuStyle"
          class="z-[100] overflow-auto rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-xl shadow-black/40 backdrop-blur"
        >
          <li
            v-for="(o, i) in options"
            :key="o.value"
            role="option"
            :aria-selected="o.value === model"
            class="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            :class="[
              i === activeIndex ? 'bg-white/10' : '',
              o.value === model ? 'font-semibold text-brand-400' : 'text-slate-200',
            ]"
            @click="choose(i)"
            @mousemove="activeIndex = i"
          >
            <span class="truncate">{{ o.label }}</span>
            <svg
              v-if="o.value === model"
              class="size-4 shrink-0 text-brand-400"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m5 10 3.5 3.5 6.5-7" />
            </svg>
          </li>
        </ul>
      </transition>
    </Teleport>
  </div>
</template>
