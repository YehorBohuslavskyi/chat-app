<script setup>
import { computed } from 'vue'
import UserAvatar from '../../../components/UserAvatar.vue'
import { isAddressed, messageParts } from '../utils/mentions.js'
const props = defineProps({ message: Object, members: Array, user: Object })
const parts = computed(() => messageParts(props.message.body, props.members))
const addressed = computed(() =>
  isAddressed(props.message.body, props.user, props.members)
)
const time = computed(() =>
  new Date(props.message.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  })
)
</script>
<template>
  <article
    class="message"
    :class="{ addressed }"
    :aria-label="addressed ? 'Message mentioning you' : undefined"
    ><UserAvatar :user="message.sender" /><div class="message-content"
      ><div class="message-meta"
        ><strong
          >{{ message.sender.firstName }} {{ message.sender.lastName }}</strong
        ><span v-if="message.senderId === user?.id" class="you-label">you</span
        ><time
          :datetime="message.createdAt"
          :title="new Date(message.createdAt).toLocaleString()"
          >{{ time }}</time
        ><span v-if="addressed" class="mention-label">mentioned you</span></div
      ><p
        ><template v-for="(part, index) in parts" :key="index"
          ><mark v-if="part.mention">{{ part.text }}</mark
          ><template v-else>{{ part.text }}</template></template
        ></p
      ></div
    ></article
  >
</template>
<style scoped>
.message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 28px;
  border-left: 3px solid transparent;
}
.message:hover {
  background: #f6f5f0;
}
.message.addressed {
  background: #edf2ff;
  border-left-color: #315ee8;
}
.message-content {
  min-width: 0;
  flex: 1;
}
.message-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.message-meta strong {
  font-size: 13px;
  font-weight: 650;
  color: #24332d;
}
.message-meta time {
  font-size: 9px;
  color: #718176;
}
.you-label {
  color: #718176;
  font-size: 9px;
}
.message p {
  font-size: 14px;
  color: #45564d;
  line-height: 1.8;
  margin: 3px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
mark {
  color: #284cbc;
  background: #dbe5ff;
  border-radius: 3px;
  padding: 1px 3px;
}
.mention-label {
  font-size: 9px;
  color: #3152aa;
  margin-left: auto;
}
@media (max-width: 600px) {
  .message {
    padding: 11px 13px;
    gap: 9px;
  }
  .message p {
    font-size: 13px;
  }
  .mention-label {
    display: none;
  }
}
</style>
