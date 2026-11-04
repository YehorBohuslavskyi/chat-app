import { onMounted, onUnmounted, ref, watch } from 'vue'
import { isDemo, workspaceService } from '../../../services/index.js'
import { useAuthStore } from '../../auth/auth.store.js'
import { useChannelsStore } from '../../channels/channels.store.js'
import { useMessagesStore } from '../messages.store.js'
import { useNotificationsStore } from '../../notifications/notifications.store.js'
import { useTypingStore } from '../typing.store.js'

export function useLiveUpdates() {
  const auth = useAuthStore()
  const channels = useChannelsStore()
  const messages = useMessagesStore()
  const notifications = useNotificationsStore()
  const typing = useTypingStore()

  const pending = ref(0)
  let syncing = false
  async function sync() {
    if (syncing || !auth.user) return
    syncing = true
    try {
      if (!isDemo) {
        await channels.sync()
        return
      }
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
    } finally {
      syncing = false
    }
  }
  function receive(kind = 'data') {
    if (!auth.user) return

    if (auth.user.status === 'offline') {
      if (kind === 'data') pending.value++
      return
    }

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
  let interval
  const focus = () => {
    if (!document.hidden) sync()
  }
  onMounted(() => {
    if (!isDemo) {
      interval = setInterval(focus, 10000)
      globalThis.addEventListener('focus', focus)
      document.addEventListener('visibilitychange', focus)
      return
    }
    stop = workspaceService.onExternalChange(receive)
    notifications.start().catch(() => {})
  })
  onUnmounted(() => {
    clearInterval(interval)
    globalThis.removeEventListener('focus', focus)
    document.removeEventListener('visibilitychange', focus)
    stop?.()
    notifications.stop()
  })
  return { pending }
}
