<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../features/auth/auth.store.js'
import { useChannelsStore } from '../features/channels/channels.store.js'
import { useMessagesStore } from '../features/chat/messages.store.js'
import { useChatActions } from '../features/chat/composables/useChatActions.js'
import ChatHeader from '../features/chat/components/ChatHeader.vue'
import MessageList from '../features/chat/components/MessageList.vue'
import MessageComposer from '../features/chat/components/MessageComposer.vue'
import TypingIndicator from '../features/chat/components/TypingIndicator.vue'
import { useTypingStore } from '../features/chat/typing.store.js'
import ChannelMembers from '../features/channels/components/ChannelMembers.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import { commandHelp } from '../features/chat/utils/parseCommand.js'
import { kickThreshold } from '../services/index.js'

const emit = defineEmits(['open-channel-dialog'])
const auth = useAuthStore()
const channels = useChannelsStore()
const messages = useMessagesStore()
const typing = useTypingStore()
const quasar = useQuasar()
const membersOpen = ref(quasar.screen.width >= 1250)
const helpOpen = ref(false)
function inviteFromMembers() {
  membersOpen.value = false
  emit('open-channel-dialog', 'invite')
}
const {
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
} = useChatActions({
  onMembers: () => {
    membersOpen.value = true
  },
  onHelp: () => {
    helpOpen.value = true
  }
})

async function simulateIncoming(options = {}) {
  if (options.delay)
    feedback.value =
      'A teammate will post in 5 seconds. Switch to another browser tab (or minimize the window) to get a notification.'
  try {
    await messages.simulateIncoming(channels.activeId, options)
  } catch (cause) {
    feedback.value = cause.message
  }
}

async function simulateTyping() {
  try {
    const { nickName } = await typing.simulateTyping(channels.activeId)
    feedback.value = `@${nickName} started typing. Click their name above the message box to watch the draft.`
  } catch (cause) {
    feedback.value = cause.message
  }
}

async function simulateInactivity() {
  try {
    await channels.simulateInactivity(channels.activeId)
  } catch (cause) {
    feedback.value = cause.message
  }
}
const canInvite = computed(
  () =>
    channels.active?.type === 'public' ||
    channels.active?.adminId === auth.user?.id
)
</script>
<template>
  <section class="chat-page" aria-label="Chat workspace"
    ><div v-if="channels.notice" class="access-notice" role="alert"
      ><q-icon name="block" size="16px" /><span>{{ channels.notice }}</span
      ><q-btn
        flat
        dense
        round
        icon="close"
        size="sm"
        aria-label="Dismiss notice"
        @click="channels.notice = ''" /></div
    ><template v-if="channels.active"
      ><ChatHeader
        :channel="channels.active"
        :members-open="membersOpen"
        @members="membersOpen = !membersOpen"
        @invite="emit('open-channel-dialog', 'invite')"
        @leave="askLeave()"
        @simulate-incoming="simulateIncoming"
        @simulate-typing="simulateTyping()"
        @simulate-inactivity="simulateInactivity()"
        @help="helpOpen = true" /><div class="conversation-body"
        ><div class="conversation-column"
          ><MessageList
            :key="channels.activeId"
            :channel="channels.active"
            :members="channels.members"
            :user="auth.user" /><div
            v-if="feedback"
            class="command-feedback"
            role="status"
            ><q-icon name="info_outline" size="16px" /><span>{{
              feedback
            }}</span
            ><q-btn
              flat
              dense
              round
              icon="close"
              size="sm"
              aria-label="Dismiss feedback"
              @click="feedback = ''" /></div
          ><TypingIndicator
            :key="channels.activeId"
            :channel="channels.active" /><MessageComposer
            :key="channels.activeId"
            :channel="channels.active"
            :members="channels.members"
            :busy="busy"
            @submit="submit" /></div
        ><ChannelMembers
          v-if="membersOpen && quasar.screen.width >= 1250"
          :members="channels.members"
          :admin-id="channels.active.adminId"
          :kick-votes="channels.active.kickVotes"
          :kick-threshold="kickThreshold"
          :can-invite="canInvite"
          @close="membersOpen = false"
          @invite="emit('open-channel-dialog', 'invite')" /></div
      ><q-dialog
        :model-value="membersOpen && quasar.screen.width < 1250"
        @update:model-value="membersOpen = $event"
        ><ChannelMembers
          :members="channels.members"
          :admin-id="channels.active.adminId"
          :kick-votes="channels.active.kickVotes"
          :kick-threshold="kickThreshold"
          :can-invite="canInvite"
          @close="membersOpen = false"
          @invite="inviteFromMembers" /></q-dialog></template
    ><div v-else-if="channels.loading" class="page-loading"
      ><q-spinner size="30px" color="primary" /><p>Opening your space…</p></div
    ><EmptyState
      v-else
      icon="forum"
      title="Your next conversation is unwritten."
      description="Choose a channel or start your own."
      ><q-btn
        color="primary"
        unelevated
        no-caps
        label="Browse channels"
        @click="emit('open-channel-dialog', 'browse')" /><q-btn
        flat
        color="primary"
        no-caps
        label="Create channel"
        class="q-ml-sm"
        @click="emit('open-channel-dialog', 'create')"
    /></EmptyState>
    <ConfirmDialog
      v-model="confirmOpen"
      :title="
        adminLeaving
          ? `Delete #${confirmChannel?.name}?`
          : `Leave #${confirmChannel?.name}?`
      "
      :description="
        adminLeaving
          ? 'You are the administrator. Leaving permanently deletes this channel and its messages for everyone in this local prototype.'
          : confirmChannel?.type === 'private'
            ? 'You will lose access to this private channel. You will need a new invitation to return.'
            : 'The channel will leave your sidebar. You can join it again from Browse channels.'
      "
      :label="adminLeaving ? 'Delete channel' : 'Leave channel'"
      :busy="confirming"
      :error="confirmError"
      @confirm="leave"
    />
    <q-dialog v-model="helpOpen"
      ><q-card class="dialog-card"
        ><q-card-section class="row items-center justify-between"
          ><h2 class="dialog-title">Go straight to it.</h2
          ><q-btn
            flat
            round
            dense
            icon="close"
            aria-label="Close command guide"
            v-close-popup /></q-card-section
        ><q-card-section class="q-pt-none"
          ><p class="text-muted">Type a command into the message box.</p
          ><div
            v-for="command in commandHelp"
            :key="command"
            class="command-help"
            ><code>{{ command }}</code
            ><span>{{
              {
                '/join channel-name [private]':
                  'Join a channel, or create it if it does not exist.',
                '/invite nickname':
                  'Add a teammate to the active channel. Administrators can also restore a banned member.',
                '/kick nickname': `Public channels: vote to remove someone. ${kickThreshold} different members, or the administrator alone, ban them permanently.`,
                '/revoke nickname':
                  'Private channels: the administrator removes a member. A new invitation restores access.',
                '/list': 'Show the people in this channel.',
                '/cancel':
                  'Leave the channel. Administrators delete it for everyone.',
                '/quit': 'Delete the channel (administrator only).',
                '/help': 'Open this guide.'
              }[command]
            }}</span></div
          ></q-card-section
        ></q-card
      ></q-dialog
    >
  </section>
</template>
<style scoped>
.chat-page {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  color: #24332d;
}
.conversation-body {
  min-height: 0;
  flex: 1;
  display: flex;
}
.conversation-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.command-feedback {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #edf2ff;
  border-radius: 6px;
  margin: 0 26px;
  padding: 6px 12px;
  color: #3152aa;
  font-size: 12px;
}
.access-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fbecee;
  color: #ae5364;
  border-radius: 6px;
  margin: 12px 26px 0;
  padding: 6px 12px;
  font-size: 12px;
}
.access-notice span,
.command-feedback span {
  flex: 1;
}
.page-loading {
  margin: auto;
  text-align: center;
  color: #64766c;
  font-size: 12px;
}
.page-loading p {
  margin-top: 14px;
}
.command-help {
  padding: 12px 0;
  border-bottom: 1px solid #e4e6dc;
}
.command-help code {
  display: block;
  color: #315ee8;
  font-size: 13px;
}
.command-help span {
  font-size: 11px;
  color: #62756a;
  display: block;
  margin-top: 6px;
}
</style>
