import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspaceService } from '../../services/index.js'

export const useMessagesStore = defineStore('messages', () => {
  const byChannel = ref({})
  let generation = 0
  const revisions = new Map()
  const stateFor = id =>
    (byChannel.value[id] ||= {
      items: [],
      loading: false,
      loaded: false,
      error: ''
    })
  async function load(id) {
    const state = stateFor(id)
    if (state.loading) return
    const ticket = generation
    const revision = revisions.get(id)
    state.loading = true
    state.error = ''
    try {
      const result = await workspaceService.recentMessages(id)
      if (ticket !== generation || revision !== revisions.get(id)) return
      const items = [...result.items, ...state.items]
      state.items = Array.from(
        new Map(items.map(item => [item.id, item])).values()
      ).sort((a, b) => a.id - b.id)
      state.loaded = true
    } catch (cause) {
      state.error = cause.message
    } finally {
      state.loading = false
    }
  }
  async function send(id, body) {
    const ticket = generation
    const revision = revisions.get(id)
    const message = await workspaceService.sendMessage(id, body)
    if (ticket !== generation || revision !== revisions.get(id)) return
    const state = stateFor(id)
    if (!state.items.some(item => item.id === message.id))
      state.items.push(message)
  }
  function reset() {
    generation++
    revisions.clear()
    byChannel.value = {}
  }
  function forget(id) {
    revisions.set(id, (revisions.get(id) || 0) + 1)
    delete byChannel.value[id]
  }
  return { byChannel, load, send, reset, forget }
})
