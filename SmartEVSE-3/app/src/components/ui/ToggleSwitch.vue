<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ label?: string; disabled?: boolean }>()
</script>

<template>
  <label class="inline-flex cursor-pointer items-center gap-3 select-none">
    <button
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      class="relative h-6 w-11 shrink-0 rounded-full border border-white/10 transition disabled:opacity-50"
      :class="model ? 'bg-brand-600' : 'bg-slate-700'"
      @click="model = !model"
    >
      <span
        class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform"
        :class="{ 'translate-x-5': model }"
      />
    </button>
    <span v-if="label" class="text-sm text-slate-200">{{ label }}</span>
  </label>
</template>
