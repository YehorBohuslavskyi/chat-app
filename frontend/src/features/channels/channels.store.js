import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { workspaceService } from '../../services/index.js'
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
  let selection = 0
  async function refresh() {
    channels.value = await workspaceService.listChannels()
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
    await refresh()
    await select(activeId.value)
  }
  async function invite(id, nickname) {
    await workspaceService.invite(id, nickname)
    await refresh()
    if (activeId.value === id) await select(id)
  }
  function reset() {
    selection++
    channels.value = []
    activeId.value = null
    members.value = []
    error.value = ''
  }
  return {
    channels,
    activeId,
    active,
    members,
    loading,
    error,
    initialize,
    select,
    create,
    join,
    leave,
    invite,
    reset
  }
})
