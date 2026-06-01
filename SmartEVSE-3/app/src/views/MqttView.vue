<script setup lang="ts">
import { computed } from 'vue'

import MqttConfig from '@/components/config/MqttConfig.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const available = computed(() => !!store.settings?.mqtt)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold">MQTT</h2>
      <p class="text-sm text-slate-400">
        Publish status and accept commands over an MQTT broker for home-automation integration.
      </p>
    </div>

    <MqttConfig />

    <div v-if="!available" class="card px-6 py-10 text-center text-sm text-slate-400">
      MQTT is not available on this device — the firmware was built without it.
    </div>
  </div>
</template>
