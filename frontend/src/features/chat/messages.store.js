import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspaceService } from '../../services/index.js'

const pageSize = 20

export const useMessagesStore = defineStore('messages', () => {
  const byChannel = ref({})
  let generation = 0
  const revisions = new Map()
  const stateFor = id =>
    (byChannel.value[id] ||= {
      items: [],
      loading: false,
      loaded: false,
      error: '',
      hasMore: false,
      loadingOlder: false,
      olderError: ''
    })

  const merge = (state, items) => {
    state.items = Array.from(
      new Map([...items, ...state.items].map(item => [item.id, item])).values()
    ).sort((a, b) => a.id - b.id)
  }

  const guard = id => {
    const ticket = generation
    const revision = revisions.get(id)
    return () => ticket === generation && revision === revisions.get(id)
  }
  async function load(id) {
    const state = stateFor(id)
    if (state.loading) return
    const current = guard(id)
    state.loading = true
    state.error = ''
    try {
      const result = await workspaceService.messageHistory(id, {
        limit: pageSize
      })
      if (!current()) return
      merge(state, result.items)
      state.hasMore = result.hasMore
      state.loaded = true
    } catch (cause) {
      if (current()) state.error = cause.message
    } finally {
      if (current()) state.loading = false
    }
  }
  async function loadOlder(id) {
    const state = stateFor(id)
    if (!state.loaded || !state.hasMore || state.loading || state.loadingOlder)
      return
    const current = guard(id)
    state.loadingOlder = true
    state.olderError = ''
    try {
      const result = await workspaceService.messageHistory(id, {
        before: state.items[0]?.id ?? null,
        limit: pageSize
      })
      if (!current()) return
      merge(state, result.items)
      state.hasMore = result.hasMore
    } catch (cause) {
      if (current()) state.olderError = cause.message
    } finally {
      if (current()) state.loadingOlder = false
    }
  }

  async function catchUp(id) {
    const state = stateFor(id)
    if (!state.loaded) return
    const current = guard(id)
    let hasMore = true
    while (hasMore) {
      const result = await workspaceService.messageHistory(id, {
        after: state.items.at(-1)?.id ?? 0,
        limit: 50
      })
      if (!current()) return
      merge(state, result.items)
      hasMore = result.hasMore
    }
  }

  async function catchUpAll() {
    const ids = Object.keys(byChannel.value).filter(
      id => byChannel.value[id].loaded
    )
    await Promise.all(ids.map(catchUp))
  }

  async function simulateIncoming(id, { delay = 0, mention = false } = {}) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    await workspaceService.simulateIncoming(id, { mention })
  }
  async function send(id, body) {
    const current = guard(id)
    const message = await workspaceService.sendMessage(id, body)
    if (!current()) return
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
  return {
    byChannel,
    load,
    loadOlder,
    catchUp,
    catchUpAll,
    simulateIncoming,
    send,
    reset,
    forget
  }
})
