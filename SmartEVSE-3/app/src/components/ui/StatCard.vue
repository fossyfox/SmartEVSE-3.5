<script setup lang="ts">
defineProps<{
  title: string
  /** Tailwind text color class for the accent dot, e.g. `text-emerald-400`. */
  accent?: string
}>()
</script>

<template>
  <section class="card flex flex-col">
    <header class="card-head">
      <span
        class="size-2 rounded-full"
        :class="accent ? accent.replace('text-', 'bg-') : 'bg-brand-500'"
      />
      <h2 class="card-title">{{ title }}</h2>
      <div class="ml-auto flex items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div class="card-body flex-1">
      <slot />
    </div>
  </section>
</template>
