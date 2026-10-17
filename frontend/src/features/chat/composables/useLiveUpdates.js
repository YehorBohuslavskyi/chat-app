import { onMounted, onUnmounted, ref, watch } from 'vue'
import { workspaceService } from '../../../services/index.js'
import { useAuthStore } from '../../auth/auth.store.js'
import { useChannelsStore } from '../../channels/channels.store.js'
import { useMessagesStore } from '../messages.store.js'
import { useNotificationsStore } from '../../notifications/notifications.store.js'

// Delivery of other people's activity. Offline suspends it; returning online
// refreshes channels and fetches the missed messages.
export function useLiveUpdates() {
  const auth = useAuthStore()
  const channels = useChannelsStore()
  const messages = useMessagesStore()
  const notifications = useNotificationsStore()
  // Updates that arrived while offline and wait for the next catch-up.
  const pending = ref(0)
  async function sync() {
    try {
      await channels.sync()
      await messages.catchUpAll()
      await notifications.check(id => channels.select(id))
    } catch (cause) {
      channels.error = cause.message
    }
  }
  function receive() {
    if (!auth.user) return
    // Offline: the update stays on the server; count it and deliver on return.
    if (auth.user.status === 'offline') {
      pending.value++
      return
    }
    sync()
  }
  watch(
    () => auth.user?.status,
    (status, previous) => {
      if (previous === 'offline' && status !== 'offline') {
        pending.value = 0
        sync()
      }
    }
  )
  let stop
  onMounted(() => {
    stop = workspaceService.onExternalChange(receive)
    notifications.start().catch(() => {})
  })
  onUnmounted(() => {
    stop?.()
    notifications.stop()
  })
  return { pending }
}
