<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useMessagesStore } from '../messages.store.js'
import MessageItem from './MessageItem.vue'
import EmptyState from '../../../components/EmptyState.vue'
const props = defineProps({
  channel: Object,
  members: Array,
  user: Object
})
const store = useMessagesStore()
const scroller = ref(null)
const atBottom = ref(true)
const state = computed(() => store.byChannel[props.channel.id])
const items = computed(() => state.value?.items || [])
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
function scroll() {
  const element = scroller.value
  atBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight < 100
}
watch(
  () => state.value?.items.length,
  () => {
    if (atBottom.value) bottom()
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
    aria-label="Recent messages"
    :aria-busy="state?.loading"
  >
    <div v-if="state?.error" class="history-error" role="alert"
      >{{ state.error }}
      <q-btn flat dense label="Retry" @click="store.load(channel.id)"
    /></div>
    <div v-if="state?.loading" class="history-loading"
      ><q-spinner size="18px" color="primary" /><span
        >Loading messages…</span
      ></div
    >
    <EmptyState
      v-if="state?.loaded && !items.length"
      title="An open page. Your first line?"
      description="Write something worth picking up."
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
@media (max-width: 600px) {
  .date-divider {
    margin-left: 16px;
    margin-right: 16px;
  }
}
</style>
