<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../features/auth/auth.store.js'
import { useChannelsStore } from '../features/channels/channels.store.js'
import { useChatActions } from '../features/chat/composables/useChatActions.js'
import ChatHeader from '../features/chat/components/ChatHeader.vue'
import MessageList from '../features/chat/components/MessageList.vue'
import MessageComposer from '../features/chat/components/MessageComposer.vue'
import ChannelMembers from '../features/channels/components/ChannelMembers.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import { commandHelp } from '../features/chat/utils/parseCommand.js'

const emit = defineEmits(['open-channel-dialog'])
const auth = useAuthStore()
const channels = useChannelsStore()
const quasar = useQuasar()
const membersOpen = ref(quasar.screen.width >= 1250)
const helpOpen = ref(false)
const search = ref('')
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
const canInvite = computed(
  () =>
    channels.active?.type === 'public' ||
    channels.active?.adminId === auth.user?.id
)
watch(
  () => channels.activeId,
  () => {
    search.value = ''
  }
)
</script>
<template>
  <section class="chat-page" aria-label="Chat workspace"
    ><template v-if="channels.active"
      ><ChatHeader
        :channel="channels.active"
        :members-open="membersOpen"
        v-model:search="search"
        @members="membersOpen = !membersOpen"
        @invite="emit('open-channel-dialog', 'invite')"
        @leave="askLeave()"
        @help="helpOpen = true" /><div class="conversation-body"
        ><div class="conversation-column"
          ><MessageList
            :key="channels.activeId"
            :channel="channels.active"
            :members="channels.members"
            :user="auth.user"
            :search="search" /><div
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
          ><MessageComposer
            :key="channels.activeId"
            :channel="channels.active"
            :members="channels.members"
            :busy="busy"
            @submit="submit" /></div
        ><ChannelMembers
          v-if="membersOpen && quasar.screen.width >= 1250"
          :members="channels.members"
          :admin-id="channels.active.adminId"
          :can-invite="canInvite"
          @close="membersOpen = false"
          @invite="emit('open-channel-dialog', 'invite')" /></div
      ><q-dialog
        :model-value="membersOpen && quasar.screen.width < 1250"
        @update:model-value="membersOpen = $event"
        ><ChannelMembers
          :members="channels.members"
          :admin-id="channels.active.adminId"
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
                '/invite nickname': 'Add a teammate to the active channel.',
                '/list': 'Show the people in this channel.',
                '/cancel':
                  'Leave the channel. Administrators delete it for everyone.',
                '/quit': 'Delete the channel (administrator only).',
                '/help': 'Open this guide.'
              }[command]
            }}</span></div
          ><p class="text-muted q-mt-lg"
            >Advanced /kick and /revoke moderation is reserved for the next
            milestone.</p
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
