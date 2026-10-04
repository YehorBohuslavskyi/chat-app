<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useMessagesStore } from '../messages.store.js'
import MessageItem from './MessageItem.vue'
import EmptyState from '../../../components/EmptyState.vue'
const props = defineProps({
  channel: Object,
  members: Array,
  user: Object,
  search: String
})
const store = useMessagesStore()
const scroller = ref(null)
const atBottom = ref(true)
const prepending = ref(false)
const state = computed(() => store.byChannel[props.channel.id])
const items = computed(() =>
  (state.value?.items || []).filter(
    message =>
      !props.search ||
      `${message.body} ${message.sender.firstName} ${message.sender.lastName}`
        .toLowerCase()
        .includes(props.search.toLowerCase())
  )
)
const dateLabel = message =>
  new Date(message.createdAt).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
async function bottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}
async function loadOlder() {
  if (
    !state.value?.hasMore ||
    state.value.loading ||
    prepending.value ||
    props.search
  )
    return
  const element = scroller.value
  const height = element.scrollHeight
  const top = element.scrollTop
  prepending.value = true
  try {
    await store.load(props.channel.id, true)
    await nextTick()
    element.scrollTop = top + element.scrollHeight - height
  } finally {
    prepending.value = false
  }
}
function scroll() {
  const element = scroller.value
  atBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight < 100
  if (element.scrollTop < 40) loadOlder()
}
watch(
  () => state.value?.items.length,
  () => {
    if (!prepending.value && atBottom.value) bottom()
  }
)
onMounted(async () => {
  if (!state.value?.loaded) await store.load(props.channel.id)
  await bottom()
})
</script>
<template>
  <div
    ref="scroller"
    class="message-list"
    @scroll.passive="scroll"
    tabindex="0"
    aria-label="Conversation history"
    :aria-busy="state?.loading"
  >
    <div v-if="state?.error" class="history-error" role="alert"
      >{{ state.error }}
      <q-btn
        flat
        dense
        label="Retry"
        @click="store.load(channel.id, state.loaded)"
    /></div>
    <div v-if="state?.loading" class="history-loading"
      ><q-spinner size="18px" color="primary" /><span
        >Loading messages…</span
      ></div
    >
    <button
      v-else-if="state?.hasMore && !search"
      class="older-button"
      @click="loadOlder"
      >Load earlier messages <q-icon name="expand_less"
    /></button>
    <div v-if="search" class="search-summary"
      >{{ items.length }} match{{ items.length === 1 ? '' : 'es' }} in loaded
      messages</div
    >
    <EmptyState
      v-if="state?.loaded && !items.length"
      :title="search ? 'No messages found' : 'An open page. Your first line?'"
      :description="
        search
          ? 'Try another word, or clear the search to load older messages.'
          : 'Write something worth picking up.'
      "
      icon="chat_bubble_outline"
    />
    <template v-for="(message, index) in items" :key="message.id"
      ><div
        v-if="index === 0 || dateLabel(message) !== dateLabel(items[index - 1])"
        class="date-divider"
        ><span>{{ dateLabel(message) }}</span></div
      ><MessageItem :message="message" :members="members" :user="user"
    /></template>
    <div class="history-end" />
  </div>
</template>
<style scoped>
.message-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: auto;
}

.date-divider {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 18px 28px 12px;
  color: #62756a;
  font-size: 9px;
}
.date-divider::before,
.date-divider::after {
  content: '';
  height: 1px;
  background: #e4e6dc;
  flex: 1;
}
.date-divider span {
  border: 1px solid #e4e6dc;
  border-radius: 20px;
  padding: 5px 14px;
}
.older-button {
  margin: 6px auto;
  display: block;
  padding: 8px 15px;
  border: 0;
  border-radius: 6px;
  background: #edf0e6;
  color: #405348;
  font-size: 10px;
  cursor: pointer;
}
.history-loading {
  display: flex;
  justify-content: center;
  gap: 8px;
  align-items: center;
  padding: 12px;
  font-size: 11px;
  color: #a391b1;
}
.history-error {
  padding: 12px 25px;
  color: #ae5364;
}
.history-end {
  height: 16px;
}
.search-summary {
  padding: 15px 30px;
  font-size: 11px;
  color: #a08bab;
}
@media (max-width: 600px) {
  .date-divider {
    margin-left: 16px;
    margin-right: 16px;
  }
}
</style>
