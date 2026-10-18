import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AppVisibility } from 'quasar'
import { workspaceService } from '../../services/index.js'
import { useAuthStore } from '../auth/auth.store.js'
import { notificationText, shouldNotify } from './rules.js'

const supported = () => typeof globalThis.Notification === 'function'
// Quasar starts with appVisible=true until its first visibilitychange event.
// Read the browser state too, including tabs initially loaded hidden.
const isVisible = () =>
  typeof globalThis.document?.hidden === 'boolean'
    ? !globalThis.document.hidden
    : AppVisibility.appVisible
// More than this many at once become one summary instead of a burst.
const burstLimit = 3

export const useNotificationsStore = defineStore('notifications', () => {
  // 'default' (not asked yet) | 'granted' | 'denied' | 'unsupported'
  const permission = ref(supported() ? Notification.permission : 'unsupported')
  const deliveryError = ref('')
  const testStatus = ref('')
  const deliveryStatus = ref('')
  let testTimer = null
  // Newest message id already considered; null until start() sets a baseline.
  let cursor = null
  let generation = 0
  let initializing = null
  let checks = Promise.resolve()
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
  function start() {
    if (initializing) return initializing
    if (cursor !== null) return Promise.resolve()
    const ticket = generation
    initializing = workspaceService
      .incoming(null)
      .then(result => {
        if (ticket === generation) cursor = result.cursor
      })
      .finally(() => {
        if (ticket === generation) initializing = null
      })
    return initializing
  }
  function stop() {
    generation++
    initializing = null
    checks = Promise.resolve()
    cursor = null
    clearTimeout(testTimer)
    testTimer = null
    testStatus.value = ''
  }
  function show(title, body, onClick) {
    deliveryError.value = ''
    deliveryStatus.value =
      'Notification requested; waiting for the browser to confirm display.'
    try {
      const notification = new Notification(title, {
        body,
        requireInteraction: true
      })
      notification.onshow = () => {
        deliveryStatus.value =
          'The browser reported that it displayed the notification. If no popup was visible, check Windows notification banners and Do not disturb.'
      }
      notification.onerror = () => {
        deliveryStatus.value = 'The browser reported a notification error.'
        deliveryError.value =
          'The browser could not display the notification. Check browser and system notification settings.'
      }
      notification.onclick = () => {
        globalThis.focus?.()
        onClick?.()
        notification.close()
      }
    } catch (cause) {
      deliveryStatus.value = 'Notification creation failed.'
      deliveryError.value =
        (cause?.message ? cause.message + ' ' : '') +
        'This browser could not show a desktop notification. Check site permissions and system notification settings.'
    }
  }
  function testNotification() {
    syncPermission()
    deliveryError.value = ''
    clearTimeout(testTimer)
    if (permission.value !== 'granted') {
      testStatus.value = 'Allow browser notifications first.'
      return
    }
    testStatus.value =
      'Switch to another tab now. A test notification will be sent in 5 seconds.'
    testTimer = setTimeout(() => {
      testTimer = null
      if (isVisible()) {
        testStatus.value =
          'Test skipped because Sideby is visible. Try again and switch tabs.'
        return
      }
      const user = useAuthStore().user
      if (!user || user.status === 'dnd' || user.status === 'offline') {
        testStatus.value = 'Choose Online status before testing notifications.'
        return
      }
      show(
        'Sideby notification test',
        'Background notifications are working.',
        () => globalThis.focus?.()
      )
      testStatus.value = deliveryError.value
        ? 'The test could not be sent.'
        : 'Test requested. See the delivery result below.'
    }, 5000)
  }
  // Serialize cursor reads so simultaneous storage events cannot notify twice.
  function check(open) {
    const ticket = generation
    const userId = useAuthStore().user?.id
    const current = () =>
      ticket === generation && userId === useAuthStore().user?.id
    const task = checks.then(async () => {
      if (!userId || !current()) return
      if (cursor === null) await start()
      if (!current()) return
      const result = await workspaceService.incoming(cursor)
      if (!current()) return
      cursor = result.cursor
      syncPermission()
      if (permission.value !== 'granted') return
      const user = useAuthStore().user
      const due = result.items.filter(message =>
        shouldNotify({ message, user, visible: isVisible() })
      )
      if (due.length > burstLimit) {
        show(due.length + ' new messages', 'Open Sideby to catch up.', () =>
          open(due.at(-1).channelId)
        )
        return
      }
      for (const message of due) {
        const { title, body } = notificationText(message)
        show(title, body, () => open(message.channelId))
      }
    })
    // A failed request must not prevent subsequent updates from being checked.
    checks = task.catch(() => {})
    return task
  }
  return {
    permission,
    deliveryError,
    deliveryStatus,
    testStatus,
    testNotification,
    syncPermission,
    requestPermission,
    start,
    stop,
    check
  }
})
