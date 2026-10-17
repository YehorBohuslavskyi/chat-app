<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { commandHelp } from '../utils/parseCommand.js'
import { useTypingStore } from '../typing.store.js'
const props = defineProps({ channel: Object, members: Array, busy: Boolean })
const emit = defineEmits(['submit'])
const body = ref('')
const input = ref(null)
const typing = useTypingStore()
// Others see this draft live; sending empties `body`, which clears it.
watch(body, text => typing.publish(props.channel.id, text))
// Switching channels remounts the composer: the old channel's draft ends.
onUnmounted(() => typing.clearOwn(props.channel.id))
const mentionQuery = computed(
  () => body.value.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/)?.[1]
)
const suggestions = computed(() =>
  mentionQuery.value === undefined
    ? []
    : props.members
        .filter(user =>
          user.nickName.startsWith(mentionQuery.value.toLowerCase())
        )
        .slice(0, 5)
)
function submit() {
  if (!body.value.trim() || props.busy) return
  emit('submit', body.value, () => {
    body.value = ''
    nextTick(() => input.value?.focus())
  })
}
function keydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
function mention(user) {
  body.value = body.value.replace(/@[a-zA-Z0-9_-]*$/, `@${user.nickName} `)
  input.value?.focus()
}
function insert(value) {
  body.value = value
  nextTick(() => input.value?.focus())
}
</script>
<template>
  <div class="composer-region"
    ><div class="composer-box"
      ><div
        v-if="suggestions.length"
        class="mention-suggestions"
        aria-label="Mention suggestions"
        ><button
          v-for="member in suggestions"
          :key="member.id"
          @click="mention(member)"
          ><strong>@{{ member.nickName }}</strong
          ><span>{{ member.firstName }} {{ member.lastName }}</span></button
        ></div
      ><label class="sr-only" :for="`compose-${channel.id}`"
        >Message {{ channel.name }}</label
      ><textarea
        :id="`compose-${channel.id}`"
        ref="input"
        v-model="body"
        :placeholder="`Write to #${channel.name}`"
        rows="2"
        maxlength="4000"
        :disabled="busy"
        @keydown="keydown" /><div class="composer-actions"
        ><div class="composer-tools"
          ><q-btn
            flat
            dense
            round
            icon="alternate_email"
            size="sm"
            aria-label="Mention a teammate"
            :disable="busy"
            @click="insert(`${body}${body && !body.endsWith(' ') ? ' ' : ''}@`)"
          /><q-btn
            flat
            dense
            round
            icon="terminal"
            size="sm"
            aria-label="Insert a command"
            :disable="busy"
            ><q-menu anchor="top left" self="bottom left"
              ><q-list
                ><q-item
                  v-for="command in commandHelp"
                  :key="command"
                  clickable
                  v-close-popup
                  @click="
                    insert(
                      command.split(' ')[0] + (command.includes(' ') ? ' ' : '')
                    )
                  "
                  ><q-item-section>{{ command }}</q-item-section></q-item
                ></q-list
              ></q-menu
            ></q-btn
          ></div
        ><div class="send-actions"
          ><span v-if="body.length > 3500" class="character-count"
            >{{ body.length }}/4000</span
          ><q-btn
            unelevated
            dense
            color="primary"
            icon="arrow_upward"
            class="send-button"
            aria-label="Send message"
            :loading="busy"
            :disable="!body.trim()"
            @click="submit" /></div></div></div
  ></div>
</template>
<style scoped>
.composer-region {
  padding: 12px 25px 24px;
  flex-shrink: 0;
}
.composer-box {
  border: 1px solid #cbd5c7;
  border-radius: 17px 17px 6px 17px;
  background: #f6f7f0;
  position: relative;
}
.composer-box:focus-within {
  border-color: #315ee8;
  box-shadow: 0 0 0 2px #315ee810;
}
textarea {
  display: block;
  width: 100%;
  resize: none;
  background: transparent;
  border: 0;
  outline: 0;
  padding: 17px 18px 5px;
  min-height: 67px;
  max-height: 140px;
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  color: #263c2e;
}
textarea::placeholder {
  color: #748173;
}
.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 12px 11px;
}
.composer-tools {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #5f7265;
}
.send-button {
  width: 36px;
  height: 34px;
  border-radius: 11px 11px 4px 11px;
}
.send-button :deep(.q-icon) {
  font-size: 20px;
}
.send-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.character-count {
  font-size: 11px;
  color: #637568;
}
.mention-suggestions {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  width: min(310px, 100%);
  padding: 6px;
  border-radius: 12px;
  background: #fffefa;
  border: 1px solid #cbd5c7;
  box-shadow: 0 8px 24px #20332d18;
  z-index: 2;
}
.mention-suggestions button {
  display: flex;
  gap: 15px;
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: 7px;
  background: transparent;
  padding: 11px;
  color: #315ee8;
  cursor: pointer;
  font-size: 13px;
}
.mention-suggestions button:hover {
  background: #edf2ff;
}
.mention-suggestions span {
  color: #62756a;
  font-size: 12px;
}
@media (max-width: 600px) {
  .composer-region {
    padding: 8px 12px 14px;
  }
  textarea {
    font-size: 16px;
  }
}
</style>
