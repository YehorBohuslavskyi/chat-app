<script setup>
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '../../auth/auth.store.js'
import { useNotificationsStore } from '../notifications.store.js'

const open = defineModel({ type: Boolean })
const auth = useAuthStore()
const notifications = useNotificationsStore()
const error = ref('')
const modeOptions = [
  { value: 'all', label: 'All new messages' },
  { value: 'mentions', label: 'Only when someone mentions me' }
]

const mode = computed({
  get: () => auth.user?.notifications ?? 'all',
  set: async value => {
    error.value = ''
    try {
      await auth.setNotificationMode(value)
    } catch (cause) {
      error.value = cause.message
    }
  }
})
watch(open, value => {
  if (value) notifications.syncPermission()
})
</script>
<template>
  <q-dialog v-model="open"
    ><q-card class="dialog-card"
      ><q-card-section class="row items-center justify-between"
        ><h2 class="dialog-title">Notifications</h2
        ><q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Close notification settings"
          v-close-popup /></q-card-section
      ><q-card-section class="q-pt-none"
        ><p class="section-label">Notify me about</p>
        <q-option-group
          v-model="mode"
          :options="modeOptions"
          type="radio"
          color="primary"
        />
        <p v-if="error" class="settings-error" role="alert">{{ error }}</p>
        <p class="section-label q-mt-lg">Browser notifications</p>
        <p v-if="notifications.permission === 'granted'" class="hint">
          Notifications are on for this browser.
        </p>
        <div v-else-if="notifications.permission === 'default'">
          <p class="hint">
            Allow notifications to hear about new messages while Sideby is in
            the background.
          </p>
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Allow notifications"
            @click="notifications.requestPermission()"
          />
        </div>
        <p
          v-else-if="notifications.permission === 'denied'"
          class="hint"
          role="alert"
        >
          Blocked by your browser. To allow them, open the site settings (the
          icon left of the address) and set Notifications to Allow, then reload.
        </p>
        <p v-else class="hint">This browser cannot show notifications.</p>
        <q-btn
          v-if="notifications.permission === 'granted'"
          outline
          no-caps
          color="primary"
          label="Test notification in 5 seconds"
          @click="notifications.testNotification()"
        />
        <p v-if="notifications.testStatus" class="hint" role="status">{{
          notifications.testStatus
        }}</p>
        <p v-if="notifications.deliveryStatus" class="hint" role="status">{{
          notifications.deliveryStatus
        }}</p>
        <p
          v-if="notifications.deliveryError"
          class="settings-error"
          role="alert"
          >{{ notifications.deliveryError }}</p
        >
        <p class="hint q-mt-md"
          >Notifications appear only while Sideby is in the background, and
          never in Do not disturb.</p
        ><p v-if="auth.user?.status === 'dnd'" class="hint dnd-hint"
          >You are in Do not disturb, so notifications are muted.</p
        ></q-card-section
      ></q-card
    ></q-dialog
  >
</template>
<style scoped>
.section-label {
  font-size: 12px;
  font-weight: 600;
  color: #24332d;
  margin: 0 0 6px;
}
.hint {
  font-size: 12px;
  color: #62756a;
  margin: 6px 0;
}
.dnd-hint {
  color: #ae5364;
}
.settings-error {
  color: #ae5364;
  font-size: 12px;
}
</style>
