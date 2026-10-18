<script setup>
import { onMounted, ref } from 'vue'
import { useNotificationsStore } from '../notifications.store.js'

const notifications = useNotificationsStore()
const open = ref(false)
const requesting = ref(false)
const error = ref('')
const dismissedKey = 'sideby-notification-prompt-dismissed'

onMounted(() => {
  notifications.syncPermission()
  let dismissed = false
  try {
    dismissed = sessionStorage.getItem(dismissedKey) === 'true'
  } catch {
    /* The prompt still works when storage is unavailable. */
  }
  open.value = notifications.permission === 'default' && !dismissed
})
function dismiss() {
  open.value = false
  try {
    sessionStorage.setItem(dismissedKey, 'true')
  } catch {
    /* Dismiss for this visit even without storage. */
  }
}
async function enable() {
  requesting.value = true
  error.value = ''
  try {
    await notifications.requestPermission()
    if (notifications.permission === 'granted') dismiss()
    else if (notifications.permission === 'denied')
      error.value =
        'Notifications are blocked. You can allow them in your browser’s site settings.'
    else if (notifications.permission === 'unsupported')
      error.value = 'This browser cannot show notifications.'
    else
      error.value =
        'Permission was not granted. Try again, or enable notifications later from your profile menu.'
  } catch {
    error.value =
      'Could not request permission. Try again or check your browser’s site settings.'
  } finally {
    requesting.value = false
  }
}
</script>

<template>
  <q-dialog v-model="open" :persistent="requesting" @hide="dismiss">
    <q-card class="dialog-card">
      <q-card-section>
        <h2 class="dialog-title">Get notified about new messages?</h2>
        <p
          >Allow Sideby to show the sender and a message preview when you switch
          to another tab or minimize the browser.</p
        >
        <p
          >You can change this in your profile’s Notifications settings. Do not
          disturb mutes notifications.</p
        >
        <p v-if="error" class="text-negative" role="alert">{{ error }}</p>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          flat
          no-caps
          label="Not now"
          :disable="requesting"
          @click="dismiss"
        />
        <q-btn
          v-if="notifications.permission === 'default'"
          unelevated
          no-caps
          color="primary"
          label="Allow notifications"
          :loading="requesting"
          @click="enable"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
