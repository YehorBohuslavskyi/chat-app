<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { staleAfterMs, useTypingStore } from '../typing.store.js'

const props = defineProps({ channel: Object })
const typing = useTypingStore()

const now = ref(Date.now())
let clock
onMounted(() => {
  typing.watchChannel(props.channel.id)
  clock = setInterval(() => {
    now.value = Date.now()
  }, 5000)
})
onUnmounted(() => {
  clearInterval(clock)
  typing.unwatchChannel(props.channel.id)
})
const active = computed(() =>
  typing.drafts.filter(
    draft => now.value - Date.parse(draft.updatedAt) < staleAfterMs
  )
)

const previewId = ref(null)
const previewName = ref('')
const preview = computed(() =>
  active.value.find(draft => draft.user.id === previewId.value)
)
function toggle(draft) {
  if (previewId.value === draft.user.id) {
    previewId.value = null
    return
  }
  previewId.value = draft.user.id
  previewName.value = draft.user.nickName
}
const separator = index =>
  index === 0 ? '' : index === active.value.length - 1 ? ' and ' : ', '
</script>
<template>
  <div class="typing-region">
    <div class="typing-line" aria-live="polite">
      <template v-if="active.length">
        <span class="typing-dots" aria-hidden="true"><i /><i /><i /></span>
        <span class="typing-text">
          <template v-for="(draft, index) in active" :key="draft.user.id"
            >{{ separator(index)
            }}<button
              type="button"
              class="typing-name"
              :class="{ selected: previewId === draft.user.id }"
              :aria-expanded="previewId === draft.user.id"
              :aria-label="`Show what @${draft.user.nickName} is typing`"
              @click="toggle(draft)"
            >
              @{{ draft.user.nickName }}
            </button></template
          >
          {{ active.length === 1 ? 'is' : 'are' }} typing…
        </span>
      </template>
    </div>
    <section
      v-if="previewId"
      class="draft-preview"
      :aria-label="`Live draft from @${previewName}`"
    >
      <header class="draft-head">
        <span
          ><q-icon name="edit_note" size="16px" /> Live draft from @{{
            previewName
          }}</span
        >
        <q-btn
          flat
          dense
          round
          icon="close"
          size="sm"
          aria-label="Close draft preview"
          @click="previewId = null"
        />
      </header>
      <p v-if="preview" class="draft-text"
        >{{ preview.text }}<span class="caret" aria-hidden="true"
      /></p>
      <p v-else class="draft-done">
        @{{ previewName }} is no longer typing. The draft was sent or deleted.
      </p>
    </section>
  </div>
</template>
<style scoped>
.typing-region {
  margin: 0 26px;
}

.typing-line {
  min-height: 22px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #62756a;
}
.typing-text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.typing-name {
  border: 0;
  background: none;
  padding: 0 1px;
  font: inherit;
  font-weight: 650;
  color: #315ee8;
  cursor: pointer;
  border-radius: 3px;
}
.typing-name:hover,
.typing-name.selected {
  text-decoration: underline;
}
.typing-name:focus-visible {
  outline: 2px solid #315ee8;
  outline-offset: 1px;
}
.typing-dots {
  display: inline-flex;
  gap: 3px;
}
.typing-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #8a988f;
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing-dots i:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dots i:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes typing-bounce {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .typing-dots i {
    animation: none;
  }
}
.draft-preview {
  margin: 4px 0 6px;
  border: 1px dashed #cdd5c8;
  border-radius: 8px;
  background: #fbfbf7;
  padding: 6px 10px 8px;
}
.draft-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: #62756a;
}
.draft-text,
.draft-done {
  margin: 4px 0 0;
  font-size: 13px;
  max-height: 96px;
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.draft-text {
  color: #24332d;
}
.draft-done {
  color: #8a988f;
  font-style: italic;
}
.caret {
  display: inline-block;
  width: 1px;
  height: 1em;
  margin-left: 1px;
  vertical-align: text-bottom;
  background: #315ee8;
  animation: caret-blink 1s steps(1) infinite;
}
@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
}
@media (max-width: 600px) {
  .typing-region {
    margin: 0 16px;
  }
}
</style>
