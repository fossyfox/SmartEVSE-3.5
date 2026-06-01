<script setup lang="ts">
import { computed } from 'vue'

import OcppConfig from '@/components/config/OcppConfig.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const available = computed(() => !!store.settings?.ocpp)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold">OCPP</h2>
      <p class="text-sm text-slate-400">
        Connect the charger to an OCPP 1.6 backend for managed charging, authorization and billing.
      </p>
    </div>

    <OcppConfig />

    <div v-if="!available" class="card px-6 py-10 text-center text-sm text-slate-400">
      OCPP is not available on this device — the firmware was built without it.
    </div>
  </div>
</template>
