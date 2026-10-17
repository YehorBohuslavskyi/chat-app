import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AppVisibility } from 'quasar'
import { workspaceService } from '../../services/index.js'
import { useAuthStore } from '../auth/auth.store.js'
import { notificationText, shouldNotify } from './rules.js'

const supported = () => typeof globalThis.Notification === 'function'
// More than this many at once become one summary instead of a burst.
const burstLimit = 3

export const useNotificationsStore = defineStore('notifications', () => {
  // 'default' (not asked yet) | 'granted' | 'denied' | 'unsupported'
  const permission = ref(supported() ? Notification.permission : 'unsupported')
  // Newest message id already considered; null until start() sets a baseline.
  let cursor = null
  // The browser can change permission outside the app (site settings).
  function syncPermission() {
    permission.value = supported() ? Notification.permission : 'unsupported'
  }
  // Browsers only allow this from a user action, such as a button click.
  async function requestPermission() {
    if (!supported()) return syncPermission()
    permission.value = await Notification.requestPermission()
  }
  // Messages that exist before sign-in never notify.
  async function start() {
    cursor = (await workspaceService.incoming(null)).cursor
  }
  function stop() {
    cursor = null
  }
  function show(title, body, onClick) {
    try {
      const notification = new Notification(title, { body })
      notification.onclick = () => {
        globalThis.focus?.()
        onClick?.()
        notification.close()
      }
    } catch {
      // Some mobile browsers only allow notifications from a service worker.
      permission.value = 'unsupported'
    }
  }
  // Called after each live-update sync. `open(channelId)` runs on click.
  async function check(open) {
    if (cursor === null) return start()
    const result = await workspaceService.incoming(cursor)
    cursor = result.cursor
    syncPermission()
    if (permission.value !== 'granted') return
    const user = useAuthStore().user
    const due = result.items.filter(message =>
      shouldNotify({ message, user, visible: AppVisibility.appVisible })
    )
    if (due.length > burstLimit) {
      show(`${due.length} new messages`, 'Open Sideby to catch up.', () =>
        open(due.at(-1).channelId)
      )
      return
    }
    for (const message of due) {
      const { title, body } = notificationText(message)
      show(title, body, () => open(message.channelId))
    }
  }
  return {
    permission,
    syncPermission,
    requestPermission,
    start,
    stop,
    check
  }
})
