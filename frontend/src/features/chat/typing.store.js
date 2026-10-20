import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspaceService } from '../../services/index.js'
import { useAuthStore } from '../auth/auth.store.js'

export const staleAfterMs = 30000

const publishEveryMs = 250

export const useTypingStore = defineStore('typing', () => {
  const drafts = ref([])
  const channelId = ref(null)
  let loading = false
  let again = false

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

  function unwatchChannel(id) {
    if (channelId.value === id) watchChannel(null)
  }
  function clearRemote() {
    drafts.value = []
  }

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
    const offline = useAuthStore().user?.status === 'offline'
    if (offline || text.trimStart().startsWith('/') || !text.trim()) text = ''
    queued = { id, text }
    if (!text) flush()
    else timer ||= setTimeout(flush, publishEveryMs)
  }
  function clearOwn(id) {
    publish(id, '')
  }

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
