<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useEvseStore } from '@/stores/evse'

const store = useEvseStore()
const ocpp = computed(() => store.settings?.ocpp)
const enabled = computed(() => ocpp.value?.mode === 'Enabled')

const editing = ref(false)
const saving = ref(false)
const form = reactive({
  backend_url: '',
  cb_id: '',
  auth_key: '',
  ca_cert: '',
  tls_verify: true,
  auto_auth_idtag: '',
})

watch(
  ocpp,
  (o) => {
    if (editing.value || !o) return
    form.backend_url = o.backend_url ?? ''
    form.cb_id = o.cb_id ?? ''
    form.auth_key = o.auth_key ?? ''
    form.tls_verify = o.tls_verify === 1
    form.auto_auth_idtag = o.auto_auth_idtag ?? ''
  },
  { immediate: true },
)

const ocppEnabledModel = computed({
  get: () => enabled.value,
  set: (v) => void store.commit({ ocpp_update: 1, ocpp_mode: v ? 1 : 0 }),
})

const autoAuthModel = computed({
  get: () => ocpp.value?.auto_auth === 'Enabled',
  set: (v) => void store.commit({ ocpp_update: 1, ocpp_auto_auth: v ? 1 : 0 }),
})

async function toggleEdit() {
  if (editing.value) {
    // Closing == save (mirrors the "Edit / Save" toggle).
    await save()
    return
  }
  editing.value = true
  try {
    form.ca_cert = await store.getOcppCaCert()
  } catch {
    /* ignore */
  }
}

async function save() {
  saving.value = true
  try {
    await store.commit({
      ocpp_update: 1,
      ocpp_backend_url: form.backend_url,
      ocpp_cb_id: form.cb_id,
      ocpp_auth_key: form.auth_key,
      ocpp_ca_cert: form.ca_cert,
      ocpp_tls_verify: form.tls_verify ? 1 : 0,
      ocpp_auto_auth_idtag: form.auto_auth_idtag,
    })
    editing.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section v-if="ocpp" class="card">
    <header class="card-head">
      <span class="size-2 rounded-full bg-brand-500" />
      <h2 class="card-title">OCPP</h2>
    </header>

    <div class="card-body space-y-4">
      <ToggleSwitch v-model="ocppEnabledModel" label="Enable OCPP" />

      <div v-if="enabled" class="space-y-4">
        <div class="stat-row">
          <span class="stat-label">WebSocket status</span>
          <span class="stat-value">{{ ocpp.status }}</span>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="field-label" for="ocpp_url">Backend URL</label>
            <input id="ocpp_url" v-model="form.backend_url" class="input" :disabled="!editing" autocomplete="off" />
          </div>
          <div>
            <label class="field-label" for="ocpp_cb">Charge Box Id</label>
            <input id="ocpp_cb" v-model="form.cb_id" class="input" :disabled="!editing" autocomplete="off" />
          </div>
          <div>
            <label class="field-label" for="ocpp_key">Password (optional)</label>
            <input id="ocpp_key" v-model="form.auth_key" type="password" class="input" :disabled="!editing" autocomplete="new-password" />
          </div>
          <div class="sm:col-span-2">
            <ToggleSwitch v-model="form.tls_verify" label="Verify TLS certificate" :disabled="!editing" />
          </div>
          <div v-if="form.tls_verify" class="sm:col-span-2">
            <label class="field-label" for="ocpp_cert">CA Certificate (PEM) — empty uses Let's Encrypt</label>
            <textarea id="ocpp_cert" v-model="form.ca_cert" rows="6" class="input font-mono text-xs" :disabled="!editing"></textarea>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 border-t border-white/5 pt-4">
          <ToggleSwitch v-model="autoAuthModel" label="Auto-authorize" />
          <div v-if="autoAuthModel" class="flex-1 min-w-48">
            <input v-model="form.auto_auth_idtag" class="input" placeholder="Default idTag" :disabled="!editing" />
          </div>
        </div>

        <button type="button" class="btn btn-primary" :disabled="saving" @click="toggleEdit">
          {{ editing ? (saving ? 'Saving…' : 'Save') : 'Edit settings' }}
        </button>
      </div>
    </div>
  </section>
</template>
