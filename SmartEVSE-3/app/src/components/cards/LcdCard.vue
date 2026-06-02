<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import StatCard from '@/components/ui/StatCard.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useLcd } from '@/composables/useLcd'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const wsUrl = computed(() => store.lcdWsUrl)
const lcd = useLcd(wsUrl)

// LCD button lock — disables the physical buttons on the device.
const lcdLock = computed({
  get: () => store.settings?.settings?.lcdlock === 1,
  set: (v) => void store.commit({ lcdlock: v ? 1 : 0 }),
})

const PIN_KEY = 'smartevse.lcdPin'
const pin = ref('')
const unlocked = ref(false)
const pinError = ref('')

const overlayClasses = computed(
  () =>
    ({
      info: 'text-slate-200',
      warning: 'text-amber-300',
      error: 'text-rose-300',
    })[lcd.statusState.value],
)

const statusChipText = computed(() => {
  if (lcd.paused.value) return 'Paused'
  return lcd.connected.value ? 'Live' : 'Offline'
})

const statusChipClass = computed(() => {
  if (lcd.paused.value) return 'bg-amber-500/15 text-amber-300'
  return lcd.connected.value ? 'bg-brand-500/15 text-brand-400' : 'bg-slate-500/15 text-slate-300'
})

async function verify(value: string, options: { showError?: boolean; remember?: boolean } = {}) {
  const { showError = true, remember = true } = options
  if (!/^\d{4}$/.test(value)) {
    unlocked.value = false
    if (showError) pinError.value = 'Enter the 4-digit PIN.'
    return
  }
  try {
    const ok = await store.verifyLcdPin(value)
    unlocked.value = ok
    if (ok) {
      pinError.value = ''
      if (remember) sessionStorage.setItem(PIN_KEY, value)
    } else {
      sessionStorage.removeItem(PIN_KEY)
      if (showError) pinError.value = 'Incorrect PIN. Please try again.'
    }
  } catch {
    unlocked.value = false
    if (showError) pinError.value = 'PIN verification failed.'
  }
}

function onSubmit() {
  void verify(pin.value)
}

function press(name: string, ev: PointerEvent) {
  ev.preventDefault()
  if (lcd.paused.value) {
    pinError.value = 'LCD is paused — resume to control the buttons.'
    return
  }
  if (!unlocked.value) {
    pinError.value = 'Buttons are locked — enter your PIN first.'
    return
  }
  lcd.pressButton(name)
}
function release(name: string) {
  if (unlocked.value && !lcd.paused.value) lcd.releaseButton(name)
}

// Icons mirror the device's silk-screen (and the classic UI's device photo):
// ▼ at the left button, a plain round select button in the middle, ▲ at the right.
const buttons = [
  { name: 'left', label: 'Left', icon: 'down' },
  { name: 'middle', label: 'Middle', icon: 'select' },
  { name: 'right', label: 'Right', icon: 'up' },
] as const

onMounted(() => {
  const stored = sessionStorage.getItem(PIN_KEY)
  if (stored && /^\d{4}$/.test(stored)) {
    pin.value = stored
    void verify(stored, { showError: false, remember: false })
  }
})
</script>

<template>
  <StatCard title="LCD Display" accent="text-violet-400">
    <template #actions>
      <button
        type="button"
        class="btn"
        :class="lcd.paused.value ? 'btn-primary' : ''"
        @click="lcd.togglePause()"
      >
        {{ lcd.paused.value ? 'Resume' : 'Pause' }}
      </button>
      <span class="chip" :class="statusChipClass">
        {{ statusChipText }}
      </span>
    </template>

    <!-- Screen -->
    <div class="relative mx-auto aspect-[2/1] w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black">
      <!--
        Firmware streams the framebuffer as BMP in RGB order, but BMP is BGR, so
        the browser swaps R/B on decode (blue text shows as red). This swaps them
        back; green and neutrals are untouched.
      -->
      <svg aria-hidden="true" class="absolute size-0 overflow-hidden">
        <filter id="lcd-rb-swap" color-interpolation-filters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 1 0 0
                    0 1 0 0 0
                    1 0 0 0 0
                    0 0 0 1 0"
          />
        </filter>
      </svg>
      <img
        v-if="lcd.frameUrl.value"
        :src="lcd.frameUrl.value"
        alt="LCD frame"
        class="size-full object-contain"
        :class="{ 'opacity-40 grayscale': lcd.paused.value }"
        style="image-rendering: pixelated; filter: url(#lcd-rb-swap)"
      />
      <!-- Paused: dim the frozen last frame and show a paused badge over it. -->
      <div
        v-if="lcd.paused.value"
        class="absolute inset-0 grid place-items-center"
      >
        <span class="chip bg-slate-950/70 text-slate-100">⏸ Paused</span>
      </div>
      <!-- Status overlay (connecting / error / no frame), only while live. -->
      <div
        v-else-if="!lcd.connected.value || !lcd.frameUrl.value"
        class="absolute inset-0 grid place-items-center px-4 text-center text-sm whitespace-pre-line"
        :class="overlayClasses"
      >
        {{ lcd.statusText.value }}
      </div>
    </div>

    <!-- Buttons — round, like the device's physical keys -->
    <div class="mx-auto mt-4 flex max-w-sm items-center justify-around">
      <button
        v-for="b in buttons"
        :key="b.name"
        type="button"
        class="grid size-12 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/5 text-slate-100 transition select-none hover:bg-white/10 active:scale-95"
        :class="{ 'opacity-50': !unlocked || lcd.paused.value }"
        :aria-label="b.label"
        :title="b.label"
        @pointerdown="press(b.name, $event)"
        @pointerup="release(b.name)"
        @pointercancel="release(b.name)"
        @pointerleave="release(b.name)"
      >
        <svg viewBox="0 0 24 24" class="size-6" fill="currentColor" aria-hidden="true">
          <path v-if="b.icon === 'down'" d="M12 16 5 7h14z" />
          <circle v-else-if="b.icon === 'select'" cx="12" cy="12" r="4.5" />
          <path v-else d="M12 8 5 17h14z" />
        </svg>
      </button>
    </div>

    <!-- LCD button lock -->
    <div class="mt-4 flex items-center gap-2 border-t border-white/5 pt-4">
      <svg
        viewBox="0 0 24 24"
        class="size-4 shrink-0 text-slate-400"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <ToggleSwitch v-model="lcdLock" label="LCD Lock" />
    </div>

    <!-- PIN -->
    <div v-if="!unlocked" class="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <form class="flex items-center gap-2" @submit.prevent="onSubmit">
        <input
          v-model="pin"
          type="password"
          inputmode="numeric"
          maxlength="4"
          pattern="[0-9]{4}"
          placeholder="Enter PIN"
          autocomplete="off"
          class="input flex-1"
        />
        <button type="submit" class="btn btn-primary">Unlock</button>
      </form>
      <p class="mt-2 text-xs" :class="pinError ? 'text-rose-300' : 'text-slate-400'">
        {{ pinError || 'LCD buttons are locked. Enter your PIN to control them remotely.' }}
      </p>
    </div>
    <p v-else class="mt-4 text-xs text-brand-400">Unlocked — buttons are active.</p>
  </StatCard>
</template>
