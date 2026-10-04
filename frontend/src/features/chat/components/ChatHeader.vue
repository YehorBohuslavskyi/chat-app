<script setup>
defineProps({ channel: Object, membersOpen: Boolean, search: String })
defineEmits(['members', 'invite', 'leave', 'help', 'update:search'])
</script>
<template>
  <header class="channel-header"
    ><div class="channel-title"
      ><span class="channel-icon"
        ><q-icon
          :name="channel.type === 'private' ? 'lock_outline' : 'tag'"
          size="24px" /></span
      ><div class="channel-title-text"
        ><h1
          >{{ channel.name
          }}<span v-if="channel.type === 'private'" class="private-label"
            >PRIVATE</span
          ></h1
        ><p>{{ channel.description || 'Room for a new subject.' }}</p></div
      ></div
    ><div class="header-actions"
      ><q-btn
        flat
        dense
        no-caps
        icon="people_outline"
        :label="String(channel.memberIds.length)"
        :class="{ 'members-active': membersOpen }"
        aria-label="Show channel members"
        @click="$emit('members')"
      /><q-btn flat round dense icon="more_horiz" aria-label="Channel actions"
        ><q-menu
          ><q-list style="min-width: 190px"
            ><q-item clickable v-close-popup @click="$emit('invite')"
              ><q-item-section avatar
                ><q-icon name="person_add_alt" /></q-item-section
              ><q-item-section>Invite a teammate</q-item-section></q-item
            ><q-item clickable v-close-popup @click="$emit('help')"
              ><q-item-section avatar><q-icon name="terminal" /></q-item-section
              ><q-item-section>Command guide</q-item-section></q-item
            ><q-separator /><q-item
              clickable
              v-close-popup
              @click="$emit('leave')"
              class="text-negative"
              ><q-item-section avatar><q-icon name="logout" /></q-item-section
              ><q-item-section>Leave channel</q-item-section></q-item
            ></q-list
          ></q-menu
        ></q-btn
      ></div
    ></header
  >
  <div class="channel-subheader"
    ><div class="conversation-tab"
      ><q-icon name="chat_bubble_outline" size="15px" /> Messages</div
    ><q-input
      :model-value="search"
      @update:model-value="$emit('update:search', $event || '')"
      borderless
      dense
      clearable
      placeholder="Search loaded messages"
      aria-label="Search loaded messages"
      class="message-search"
      ><template #prepend
        ><q-icon name="search" size="17px" /></template></q-input
  ></div>
</template>
<style scoped>
.channel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 23px 28px 20px;
}
.channel-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}
.channel-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #edf2ff;
  color: #315ee8;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.channel-title-text {
  min-width: 0;
}
h1 {
  font-size: 22px;
  font-weight: 650;
  line-height: 1.3;
  margin: 0;
  letter-spacing: -0.5px;
  overflow-wrap: anywhere;
}
.private-label {
  font-size: 8px;
  font-weight: 500;
  color: #62756a;
  border: 1px solid #cdd5c8;
  border-radius: 3px;
  padding: 2px 4px;
  margin-left: 10px;
  vertical-align: middle;
  letter-spacing: 0.6px;
}
p {
  margin: 5px 0 0;
  font-size: 13px;
  color: #62756a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-actions {
  display: flex;
  gap: 13px;
  align-items: center;
  color: #62756a;
  flex-shrink: 0;
}
.header-actions .q-btn {
  font-size: 11px;
}
.members-active {
  background: #edf2ff;
  color: #315ee8;
}
.channel-subheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  gap: 10px;
  border-bottom: 1px solid #e4e6dc;
  height: 44px;
  flex-shrink: 0;
}
.conversation-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #315ee8;
  border-bottom: 2px solid #315ee8;
  height: 100%;
  font-size: 13px;
  font-weight: 600;
}
.message-search {
  width: 195px;
}
.message-search :deep(input) {
  font-size: 12px;
}
.message-search :deep(.q-field__prepend) {
  padding-right: 6px;
  color: #718176;
}
@media (max-width: 600px) {
  .channel-header {
    padding: 18px 16px;
  }
  .channel-icon {
    display: none;
  }
  .channel-subheader {
    padding: 0 16px;
  }
  .channel-title h1 {
    font-size: 17px;
  }
  .header-actions {
    gap: 6px;
  }
  .message-search {
    width: 150px;
  }
  .conversation-tab {
    font-size: 10px;
  }
}
</style>
