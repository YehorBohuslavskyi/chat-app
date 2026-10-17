import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspaceService } from '../../services/index.js'
import { useAuthStore } from '../auth/auth.store.js'

// A draft not updated for this long is treated as abandoned (e.g. a closed tab).
export const staleAfterMs = 30000
// Own keystrokes are sent at most this often; clearing is sent immediately.
const publishEveryMs = 250

export const useTypingStore = defineStore('typing', () => {
  // Other members' drafts in the watched channel: [{ user, text, updatedAt }].
  const drafts = ref([])
  const channelId = ref(null)
  let loading = false
  let again = false
  // Typing produces bursts of updates: one request at a time, plus one more
  // afterwards if anything changed meanwhile.
  async function refresh() {
    const id = channelId.value
    if (!id) return
    if (loading) {
      again = true
      return
    }
    loading = true
    try {
      const result = await workspaceService.drafts(id)
      if (channelId.value === id) drafts.value = result
    } catch {
      // Lost access or signed out: nobody is shown typing.
      if (channelId.value === id) drafts.value = []
    } finally {
      loading = false
      if (again) {
        again = false
        refresh()
      }
    }
  }
  function watchChannel(id) {
    channelId.value = id
    drafts.value = []
    refresh()
  }
  // Only the component watching `id` may stop watching it.
  function unwatchChannel(id) {
    if (channelId.value === id) watchChannel(null)
  }
  function clearRemote() {
    drafts.value = []
  }

  // Own draft per channel as last sent, so unchanged text is not resent.
  const published = new Map()
  let queued = null
  let timer = null
  function flush() {
    clearTimeout(timer)
    timer = null
    if (!queued) return
    const { id, text } = queued
    queued = null
    if ((published.get(id) || '') === text) return
    published.set(id, text)
    workspaceService.setDraft(id, text).catch(() => {})
  }
  function publish(id, text) {
    // Commands are not messages, and offline users broadcast nothing.
    const offline = useAuthStore().user?.status === 'offline'
    if (offline || text.trimStart().startsWith('/') || !text.trim()) text = ''
    queued = { id, text }
    if (!text) flush()
    else timer ||= setTimeout(flush, publishEveryMs)
  }
  function clearOwn(id) {
    publish(id, '')
  }
  // Going offline or signing out: withdraw every draft this tab published.
  function withdrawAll() {
    for (const [id, text] of published) if (text) clearOwn(id)
  }
  function reset() {
    clearTimeout(timer)
    timer = null
    queued = null
    published.clear()
    channelId.value = null
    drafts.value = []
  }
  return {
    drafts,
    channelId,
    refresh,
    watchChannel,
    unwatchChannel,
    clearRemote,
    publish,
    clearOwn,
    withdrawAll,
    reset,
    simulateTyping: id => workspaceService.simulateTyping(id)
  }
})
