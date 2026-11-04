import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { inactiveDays, workspaceService } from '../../services/index.js'
import { useMessagesStore } from '../chat/messages.store.js'

export const useChannelsStore = defineStore('channels', () => {
  const channels = ref([])
  const activeId = ref(null)
  const members = ref([])
  const loading = ref(false)
  const error = ref('')
  const active = computed(() =>
    channels.value.find(channel => channel.id === activeId.value)
  )

  const notice = ref('')
  let selection = 0
  let refreshVersion = 0
  async function refresh() {
    const ticket = ++refreshVersion
    const previous = active.value
    const before = channels.value
    const result = await workspaceService.listChannels()
    if (ticket !== refreshVersion) return
    channels.value = result

    const remaining = new Set(channels.value.map(channel => channel.id))
    for (const channel of before)
      if (!remaining.has(channel.id)) useMessagesStore().forget(channel.id)
    if (previous && !remaining.has(previous.id))
      notice.value = `You no longer have access to #${previous.name}. You were removed, or the channel was deleted or expired after ${inactiveDays} days without messages.`
    if (!channels.value.some(channel => channel.id === activeId.value)) {
      selection++
      members.value = []
      activeId.value =
        channels.value.find(channel => channel.id === 'general')?.id ||
        channels.value[0]?.id ||
        null
    }
  }
  async function select(id) {
    const ticket = ++selection
    activeId.value = id
    members.value = []
    if (!id) return
    try {
      const result = await workspaceService.members(id)
      if (ticket !== selection) return
      members.value = result
      const channel = await workspaceService.acknowledgeInvitation(id)
      if (ticket !== selection) return
      const index = channels.value.findIndex(item => item.id === id)
      if (index >= 0 && channel) channels.value[index] = channel
    } catch (cause) {
      if (ticket !== selection) return
      if ([403, 404].includes(cause.status)) {
        useMessagesStore().forget(id)
        channels.value = channels.value.filter(channel => channel.id !== id)
        activeId.value = null
        members.value = []
        notice.value = 'This channel is no longer available to you.'
      }
      throw cause
    }
  }
  async function initialize() {
    loading.value = true
    error.value = ''
    try {
      await refresh()
      await select(activeId.value)
    } catch (cause) {
      error.value = cause.message
    } finally {
      loading.value = false
    }
  }
  async function create(input) {
    const channel = await workspaceService.createChannel(input)
    await refresh()
    await select(channel.id)
  }
  async function join(name, type) {
    const channel = await workspaceService.joinChannel(name, type)
    await refresh()
    await select(channel.id)
  }
  async function leave(id, deleteOnly) {
    await workspaceService.leaveChannel(id, deleteOnly)
    useMessagesStore().forget(id)

    if (activeId.value === id) activeId.value = null
    await refresh()
    await select(activeId.value)
  }
  async function updateMembership(action, id, nickname) {
    const result = await workspaceService[action](id, nickname)
    await refresh()
    if (activeId.value === id) await select(id)
    return result
  }
  async function invite(id, nickname) {
    await updateMembership('invite', id, nickname)
  }
  function kick(id, nickname) {
    return updateMembership('kick', id, nickname)
  }
  function revoke(id, nickname) {
    return updateMembership('revoke', id, nickname)
  }

  async function simulateInactivity(id) {
    const name = channels.value.find(channel => channel.id === id)?.name
    await workspaceService.simulateInactivity(id)
    await refresh()
    await select(activeId.value)
    notice.value = `#${name} expired after ${inactiveDays} days without messages and was deleted. Its name can be used for a new channel.`
  }

  async function sync() {
    await refresh()
    await select(activeId.value)
    error.value = ''
  }
  function reset() {
    selection++
    refreshVersion++
    channels.value = []
    activeId.value = null
    members.value = []
    error.value = ''
    notice.value = ''
  }
  return {
    channels,
    activeId,
    active,
    members,
    loading,
    error,
    notice,
    initialize,
    select,
    create,
    join,
    leave,
    invite,
    kick,
    revoke,
    sync,
    simulateInactivity,
    reset
  }
})
