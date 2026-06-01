<script setup lang="ts">
defineProps<{
  label: string
  value?: string | number | null
  /** Optional tooltip on the value. */
  title?: string
}>()
</script>

<template>
  <div class="stat-row">
    <span class="stat-label">{{ label }}</span>
    <span class="stat-value" :title="title">
      <slot>{{ value ?? '—' }}</slot>
    </span>
  </div>
</template>
