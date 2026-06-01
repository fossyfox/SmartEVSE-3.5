<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const mqtt = computed(() => store.settings?.mqtt)

const editing = ref(false)
const saving = ref(false)
const form = reactive({
  host: '',
  port: 1883 as number,
  username: '',
  password: '',
  topic_prefix: '',
  tls: false,
  ca_cert: '',
})

// Keep the form in sync with device state while not actively editing.
watch(
  mqtt,
  (m) => {
    if (editing.value || !m) return
    form.host = m.host ?? ''
    form.port = m.port ?? 1883
    form.username = m.username ?? ''
    form.password = m.password ?? ''
    form.topic_prefix = m.topic_prefix ?? ''
    form.tls = !!m.tls
    form.ca_cert = m.ca_cert ?? ''
  },
  { immediate: true },
)

async function toggleEdit() {
  editing.value = !editing.value
  if (editing.value) {
    try {
      form.ca_cert = await store.getMqttCaCert()
    } catch {
      /* keep whatever we have */
    }
  }
}

async function save() {
  saving.value = true
  try {
    await store.commit({
      mqtt_update: 1,
      mqtt_host: form.host,
      mqtt_port: form.port,
      mqtt_username: form.username,
      mqtt_password: form.password,
      mqtt_topic_prefix: form.topic_prefix,
      mqtt_tls: form.tls ? 1 : 0,
      mqtt_ca_cert: form.ca_cert,
    })
    editing.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section v-if="mqtt" class="card">
    <header class="card-head">
      <span class="size-2 rounded-full bg-brand-500" />
      <h2 class="card-title">MQTT</h2>
      <span
        class="ml-auto chip"
        :class="mqtt.status === 'Connected' ? 'bg-brand-500/15 text-brand-400' : 'bg-slate-500/15 text-slate-300'"
      >
        {{ mqtt.status || 'N/A' }}
      </span>
    </header>

    <div class="card-body space-y-4">
      <button type="button" class="btn btn-sm" @click="toggleEdit">
        {{ editing ? 'Close settings' : 'Edit settings' }}
      </button>

      <div v-if="editing" class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="field-label" for="mqtt_host">Host <span class="text-slate-500">(empty = disabled)</span></label>
          <input id="mqtt_host" v-model="form.host" class="input" autocomplete="off" />
        </div>
        <div>
          <label class="field-label" for="mqtt_port">Port</label>
          <input id="mqtt_port" v-model.number="form.port" type="number" class="input" />
        </div>
        <div>
          <label class="field-label" for="mqtt_user">Username</label>
          <input id="mqtt_user" v-model="form.username" class="input" autocomplete="off" />
        </div>
        <div>
          <label class="field-label" for="mqtt_pass">Password</label>
          <input id="mqtt_pass" v-model="form.password" type="password" class="input" autocomplete="new-password" />
        </div>
        <div class="sm:col-span-2">
          <label class="field-label" for="mqtt_topic">Topic prefix</label>
          <input id="mqtt_topic" v-model="form.topic_prefix" class="input" />
        </div>
        <div class="sm:col-span-2">
          <ToggleSwitch v-model="form.tls" label="Enable TLS" />
        </div>
        <div v-if="form.tls" class="sm:col-span-2">
          <label class="field-label" for="mqtt_cert">CA Certificate (PEM) — empty uses Let's Encrypt</label>
          <textarea id="mqtt_cert" v-model="form.ca_cert" rows="6" class="input font-mono text-xs"></textarea>
        </div>
        <div class="sm:col-span-2">
          <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
