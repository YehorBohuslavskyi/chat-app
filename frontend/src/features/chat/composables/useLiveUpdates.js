import { onMounted, onUnmounted, ref, watch } from 'vue'
import { workspaceService } from '../../../services/index.js'
import { useAuthStore } from '../../auth/auth.store.js'
import { useChannelsStore } from '../../channels/channels.store.js'
import { useMessagesStore } from '../messages.store.js'
import { useNotificationsStore } from '../../notifications/notifications.store.js'
import { useTypingStore } from '../typing.store.js'

// Delivery of other people's activity. Offline suspends it; returning online
// refreshes channels and fetches the missed messages.
export function useLiveUpdates() {
  const auth = useAuthStore()
  const channels = useChannelsStore()
  const messages = useMessagesStore()
  const notifications = useNotificationsStore()
  const typing = useTypingStore()
  // Updates that arrived while offline and wait for the next catch-up.
  const pending = ref(0)
  async function sync() {
    try {
      // Notification delivery must not depend on history or membership refresh succeeding.
      const results = await Promise.allSettled([
        notifications.check(id => channels.select(id)),
        (async () => {
          await channels.sync()
          await messages.catchUpAll()
          await typing.refresh()
        })()
      ])
      const failure = results.find(result => result.status === 'rejected')
      if (failure) throw failure.reason
    } catch (cause) {
      channels.error = cause.message
    }
  }
  function receive(kind = 'data') {
    if (!auth.user) return
    // Offline: the update stays on the server; count it and deliver on return.
    // Drafts are live-only, so there is nothing of them to catch up on later.
    if (auth.user.status === 'offline') {
      if (kind === 'data') pending.value++
      return
    }
    // A keystroke elsewhere only needs the drafts, not a full sync.
    if (kind === 'drafts') typing.refresh()
    else sync()
  }
  watch(
    () => auth.user?.status,
    (status, previous) => {
      if (previous === 'offline' && status !== 'offline') {
        pending.value = 0
        sync()
      }
      if (status === 'offline') {
        typing.clearRemote()
        typing.withdrawAll()
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
