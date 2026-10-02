<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ channels: Array, activeId: String, userId: String })
defineEmits(['select', 'create', 'browse'])
const filter = ref('')
const filtered = computed(() =>
  props.channels.filter(channel =>
    channel.name.includes(filter.value.trim().toLowerCase())
  )
)
</script>
<template>
  <nav class="channel-navigation" aria-label="Channels">
    <q-input
      v-model="filter"
      dark
      dense
      borderless
      placeholder="Find a channel"
      class="channel-filter"
      aria-label="Filter your channels"
      ><template #prepend><q-icon name="search" size="17px" /></template
    ></q-input>
    <button class="browse-link" @click="$emit('browse')"
      ><q-icon name="explore" size="19px" /> Browse channels
      <q-icon name="north_east" size="14px" class="q-ml-auto"
    /></button>
    <div class="section-title"
      ><span
        >CHANNELS <span class="channel-count">{{ channels.length }}</span></span
      ><q-btn
        flat
        dense
        round
        size="sm"
        icon="add"
        aria-label="Create channel"
        @click="$emit('create')"
    /></div>
    <div v-if="!filtered.length" class="no-channels">{{
      filter
        ? 'No matching channels.'
        : 'A fresh start. Create or join a channel.'
    }}</div>
    <button
      v-for="channel in filtered"
      :key="channel.id"
      class="channel-row"
      :class="{
        active: channel.id === activeId,
        invited: channel.invitedIds.includes(userId)
      }"
      :aria-current="channel.id === activeId ? 'page' : undefined"
      @click="$emit('select', channel.id)"
    >
      <q-icon
        :name="channel.type === 'private' ? 'lock_outline' : 'tag'"
        size="19px"
      /><span class="ellipsis">{{ channel.name }}</span
      ><span v-if="channel.invitedIds.includes(userId)" class="invite-badge"
        >NEW</span
      >
    </button>
    <button class="add-channel" @click="$emit('create')"
      ><q-icon name="add" size="18px" /> New channel</button
    >
  </nav>
</template>
<style scoped>
.channel-navigation {
  padding: 10px 12px 20px;
}
.channel-filter {
  background: #ffffff08;
  border: 1px solid #657d663f;
  border-radius: 9px;
  padding: 0 11px;
  margin: 0 0 18px;
}
.channel-filter :deep(input) {
  font-size: 13px;
}
.browse-link,
.channel-row,
.add-channel {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: transparent;
  border: 0;
  color: #c7d4c9;
  text-align: left;
  border-radius: 8px;
  padding: 11px 12px;
  cursor: pointer;
  font-size: 14px;
}
.browse-link:hover,
.channel-row:hover,
.add-channel:hover {
  background: #ffffff0c;
  color: #fffefa;
}
.browse-link {
  margin-bottom: 22px;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 8px;
  color: #9eb3a3;
  font-size: 10px;
  letter-spacing: 1.4px;
  font-weight: 600;
}
.channel-count {
  margin-left: 6px;
  color: #c2d0c3;
}
.channel-row {
  margin: 4px 0;
  min-height: 42px;
}
.channel-row.active {
  background: #e0f38b;
  color: #20332d;
  font-weight: 650;
  border-radius: 10px 10px 3px 10px;
}
.channel-row > .q-icon {
  opacity: 0.8;
}
.channel-row.invited:not(.active) {
  color: #e0f38b;
}
.invite-badge {
  margin-left: auto;
  font-size: 9px;
  letter-spacing: 0.7px;
  background: #e0f38b;
  color: #20332d;
  border-radius: 4px;
  padding: 2px 5px;
}
.add-channel {
  color: #a5bcaa;
  margin-top: 12px;
  font-size: 13px;
}
.no-channels {
  padding: 12px;
  font-size: 13px;
  color: #b8cbbb;
}
</style>
