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
  // Shown when the open channel disappears without the user leaving it (kick, ban, revoke).
  const notice = ref('')
  let selection = 0
  async function refresh() {
    const previous = active.value
    const before = channels.value
    channels.value = await workspaceService.listChannels()
    // Drop cached messages of every channel that disappeared, not only the open one.
    const remaining = new Set(channels.value.map(channel => channel.id))
    for (const channel of before)
      if (!remaining.has(channel.id)) useMessagesStore().forget(channel.id)
    if (previous && !remaining.has(previous.id))
      notice.value = `You no longer have access to #${previous.name}. You were removed, or the channel was deleted or expired after ${inactiveDays} days without messages.`
    if (!channels.value.some(channel => channel.id === activeId.value))
      activeId.value =
        channels.value.find(channel => channel.id === 'general')?.id ||
        channels.value[0]?.id ||
        null
  }
  async function select(id) {
    const ticket = ++selection
    activeId.value = id
    members.value = []
    if (!id) return
    const result = await workspaceService.members(id)
    if (ticket !== selection) return
    members.value = result
    const channel = await workspaceService.acknowledgeInvitation(id)
    const index = channels.value.findIndex(item => item.id === id)
    if (index >= 0) channels.value[index] = channel
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
    // Leaving on purpose is not a lost-access event, so clear the selection first.
    if (activeId.value === id) activeId.value = null
    await refresh()
    await select(activeId.value)
  }
  async function invite(id, nickname) {
    await workspaceService.invite(id, nickname)
    await refresh()
    if (activeId.value === id) await select(id)
  }
  // Both return the service result so the caller can describe what happened.
  async function kick(id, nickname) {
    const result = await workspaceService.kick(id, nickname)
    await refresh()
    if (activeId.value === id) await select(id)
    return result
  }
  async function revoke(id, nickname) {
    const result = await workspaceService.revoke(id, nickname)
    await refresh()
    if (activeId.value === id) await select(id)
    return result
  }
  // Demo: age the channel past the limit, then let the expiry sweep remove it.
  async function simulateInactivity(id) {
    // The service deletes the channel, so its name must be read beforehand.
    const name = channels.value.find(channel => channel.id === id)?.name
    await workspaceService.simulateInactivity(id)
    await refresh()
    await select(activeId.value)
    notice.value = `#${name} expired after ${inactiveDays} days without messages and was deleted. Its name can be used for a new channel.`
  }
  // Re-read channels and the open channel's members after someone else's change.
  // Called by useLiveUpdates, which decides when delivery is allowed (not offline).
  async function sync() {
    if (!channels.value.length && !activeId.value) return
    await refresh()
    await select(activeId.value)
  }
  function reset() {
    selection++
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
