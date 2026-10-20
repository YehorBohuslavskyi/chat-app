import { computed, ref, watch } from 'vue'
import { useAuthStore } from '../../auth/auth.store.js'
import { useChannelsStore } from '../../channels/channels.store.js'
import { useMessagesStore } from '../messages.store.js'
import { parseCommand } from '../utils/parseCommand.js'

export function useChatActions({ onMembers, onHelp }) {
  const auth = useAuthStore()
  const channels = useChannelsStore()
  const messages = useMessagesStore()
  const busy = ref(false)
  const feedback = ref('')
  const confirmOpen = ref(false)
  const confirmChannel = ref(null)
  const confirmError = ref('')
  const deleteOnly = ref(false)
  const confirming = ref(false)
  const adminLeaving = computed(
    () => confirmChannel.value?.adminId === auth.user?.id
  )
  watch(
    () => channels.activeId,
    () => {
      feedback.value = ''
    }
  )
  function askLeave(onlyDelete = false) {
    if (!channels.active) return
    if (onlyDelete && channels.active.adminId !== auth.user.id)
      throw new Error('Only the administrator can delete this channel.')
    confirmChannel.value = { ...channels.active }
    deleteOnly.value = onlyDelete
    confirmError.value = ''
    confirmOpen.value = true
  }
  async function leave() {
    if (confirming.value) return
    confirming.value = true
    try {
      await channels.leave(confirmChannel.value.id, deleteOnly.value)
      confirmOpen.value = false
    } catch (cause) {
      confirmError.value = cause.message
    } finally {
      confirming.value = false
    }
  }
  async function submit(body, clear) {
    if (busy.value) return
    const channelId = channels.activeId
    busy.value = true
    feedback.value = ''
    try {
      const parsed = parseCommand(body)

      if (parsed.type === 'message' && auth.user?.status === 'offline')
        throw new Error('You are offline. Go online to send messages.')
      if (parsed.type === 'message') await messages.send(channelId, parsed.body)
      else {
        switch (parsed.name) {
          case 'join':
            await channels.join(...parsed.args)
            break
          case 'invite':
            await channels.invite(channelId, parsed.args[0])
            if (channels.activeId === channelId)
              feedback.value = `Invited @${parsed.args[0].replace(/^@/, '')} to the channel.`
            break
          case 'kick': {
            const result = await channels.kick(channelId, parsed.args[0])
            if (channels.activeId === channelId)
              feedback.value =
                result.outcome === 'banned'
                  ? `@${result.nickName} is now banned from this channel.`
                  : `Your vote to kick @${result.nickName} was counted (${result.votes}/${result.needed}).`
            break
          }
          case 'revoke': {
            const result = await channels.revoke(channelId, parsed.args[0])
            if (channels.activeId === channelId)
              feedback.value = `Removed @${result.nickName} from this channel`
            break
          }
          case 'list':
            onMembers()
            break
          case 'cancel':
            askLeave()
            break
          case 'quit':
            askLeave(true)
            break
          case 'help':
            onHelp()
            break
        }
      }
      clear()
    } catch (cause) {
      if (channels.activeId === channelId) feedback.value = cause.message
    } finally {
      busy.value = false
    }
  }
  return {
    busy,
    feedback,
    confirmOpen,
    confirmChannel,
    confirmError,
    confirming,
    adminLeaving,
    askLeave,
    leave,
    submit
  }
}
