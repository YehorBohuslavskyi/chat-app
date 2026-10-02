<script setup>
import { computed, ref, watch } from 'vue'
import { useChannelsStore } from '../channels.store.js'
import { useAuthStore } from '../../auth/auth.store.js'
import { workspaceService } from '../../../services/index.js'
const props = defineProps({
  modelValue: Boolean,
  mode: { type: String, default: 'create' },
  channelId: String
})
const emit = defineEmits(['update:modelValue'])
const channels = useChannelsStore()
const auth = useAuthStore()
const name = ref('')
const description = ref('')
const type = ref('public')
const error = ref('')
const busy = ref(false)
const available = ref([])
const title = computed(
  () =>
    ({
      create: 'Give it a channel.',
      browse: 'Pick a conversation.',
      invite: 'Pull up another chair.'
    })[props.mode]
)
const results = computed(() =>
  available.value.filter(channel =>
    channel.name.includes(name.value.toLowerCase())
  )
)
async function browse() {
  busy.value = true
  error.value = ''
  try {
    available.value = await workspaceService.browseChannels()
  } catch (cause) {
    error.value = cause.message
  } finally {
    busy.value = false
  }
}
watch(
  () => props.modelValue,
  async open => {
    if (!open) return
    name.value = ''
    description.value = ''
    type.value = 'public'
    error.value = ''
    available.value = []
    if (props.mode === 'browse') await browse()
  }
)
async function submit(channelName) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (props.mode === 'create')
      await channels.create({
        name: name.value,
        description: description.value,
        type: type.value
      })
    else if (props.mode === 'invite')
      await channels.invite(props.channelId, name.value)
    else await channels.join(channelName)
    emit('update:modelValue', false)
  } catch (cause) {
    error.value = cause.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <q-dialog
    :model-value="modelValue"
    :persistent="busy"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="dialog-card">
      <q-card-section class="row items-center justify-between"
        ><div class="eyebrow">{{
          mode === 'browse'
            ? 'EXPLORE CHANNELS'
            : mode === 'invite'
              ? 'INVITE A TEAMMATE'
              : 'CREATE A CHANNEL'
        }}</div
        ><q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Close dialog"
          :disable="busy"
          v-close-popup
      /></q-card-section>
      <q-card-section class="q-pt-none"
        ><h2 class="dialog-title">{{ title }}</h2
        ><p class="text-muted q-mt-sm">{{
          mode === 'invite'
            ? 'Add someone by nickname.'
            : mode === 'browse'
              ? 'Open a channel, or join one you haven’t met yet.'
              : 'One subject. Its own place.'
        }}</p>
        <q-form @submit="submit()" class="q-gutter-y-md">
          <q-input
            v-model="name"
            outlined
            autofocus
            :label="
              mode === 'invite'
                ? 'Nickname'
                : mode === 'browse'
                  ? 'Search public channels'
                  : 'Channel name'
            "
            :prefix="mode === 'invite' ? '@' : '#'"
            :maxlength="32"
            :rules="
              mode === 'browse'
                ? []
                : [value => !!value.trim() || 'Enter a name']
            "
          />
          <template v-if="mode === 'create'"
            ><q-input
              v-model="description"
              outlined
              label="Description (optional)"
              type="textarea"
              rows="2"
              maxlength="160"
            /><div class="privacy-options"
              ><q-radio v-model="type" val="public" label="Public" /><q-radio
                v-model="type"
                val="private"
                label="Private" /></div
            ><p class="text-muted small">{{
              type === 'public'
                ? 'Anyone in the workspace can find and join this channel.'
                : 'Only invited members can read and send messages.'
            }}</p></template
          >
          <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
          <template v-if="mode === 'browse'"
            ><q-linear-progress v-if="busy" indeterminate color="primary" /><div
              class="browse-results"
              ><button
                v-for="channel in results"
                :key="channel.id"
                type="button"
                class="browse-result"
                :disabled="busy"
                @click="submit(channel.name)"
                ><span
                  ><strong># {{ channel.name }}</strong
                  ><small>{{ channel.description }}</small></span
                ><span class="join-label"
                  >{{
                    channel.memberIds.includes(auth.user.id) ? 'Open' : 'Join'
                  }}
                  <q-icon name="arrow_forward" /></span></button
              ><p v-if="!busy && !results.length" class="text-muted"
                >Nothing here by that name.</p
              ></div
            ><q-btn v-if="error" flat label="Retry" @click="browse"
          /></template>
          <q-btn
            v-else
            type="submit"
            unelevated
            color="primary"
            class="full-width"
            :label="mode === 'invite' ? 'Invite to channel' : 'Create channel'"
            no-caps
            :loading="busy"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<style scoped>
.eyebrow {
  color: #62756a;
  font-size: 10px;
  letter-spacing: 1.5px;
  font-weight: 600;
}
.small {
  font-size: 12px;
}
.privacy-options {
  display: flex;
  gap: 30px;
}
.browse-results {
  max-height: 330px;
  overflow-y: auto;
}
.browse-result {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  width: 100%;
  padding: 16px 2px;
  border: 0;
  border-bottom: 1px solid #e4e6dc;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.browse-result:hover {
  background: #edf2ff;
}
.browse-result small {
  display: block;
  color: #62756a;
  font-size: 11px;
  margin-top: 5px;
}
.join-label {
  white-space: nowrap;
  color: #315ee8;
  font-size: 12px;
}
</style>
