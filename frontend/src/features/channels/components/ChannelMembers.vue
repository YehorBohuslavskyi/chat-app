<script setup>
import UserAvatar from '../../../components/UserAvatar.vue'
defineProps({
  members: Array,
  adminId: String,
  canInvite: Boolean,

  kickVotes: { type: Object, default: () => ({}) },
  kickThreshold: Number
})
defineEmits(['invite', 'close'])
</script>
<template>
  <aside class="members-panel" aria-label="Channel members"
    ><div class="members-heading"
      ><span
        >The people <small>{{ members.length }}</small></span
      ><q-btn
        flat
        dense
        round
        icon="close"
        size="sm"
        aria-label="Close members panel"
        @click="$emit('close')" /></div
    ><div v-for="member in members" :key="member.id" class="member"
      ><UserAvatar :user="member" :size="33" presence /><div class="member-info"
        ><strong>{{ member.firstName }} {{ member.lastName }}</strong
        ><span
          >@{{ member.nickName }} ·
          {{ member.status === 'dnd' ? 'Do not disturb' : member.status }}</span
        ></div
      ><span v-if="kickVotes[member.id]?.length" class="kick-votes"
        >{{ kickVotes[member.id].length }}/{{ kickThreshold
        }}<q-tooltip>Kick votes toward a permanent ban</q-tooltip></span
      >

      <q-icon
        v-if="member.id === adminId"
        name="shield"
        size="15px"
        class="admin-icon"
        ><q-tooltip>Channel administrator</q-tooltip></q-icon
      ></div
    ><q-btn
      v-if="canInvite"
      flat
      no-caps
      icon="person_add_alt"
      label="Add someone"
      class="invite-button"
      @click="$emit('invite')"
  /></aside>
</template>
<style scoped>
.members-panel {
  width: 245px;
  height: 100%;
  max-height: 90dvh;
  background: #f6f5f0;
  border-left: 1px solid #e4e6dc;
  padding: 22px 18px;
  overflow-y: auto;
}
.members-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 650;
  font-size: 13px;
  color: #24332d;
}
.members-heading small {
  font-size: 10px;
  font-weight: 400;
  margin-left: 7px;
  color: #687b6d;
}

.member {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 20px 0;
}
.member-info {
  min-width: 0;
  flex: 1;
}
.member-info strong {
  display: block;
  color: #263c2e;
  font-size: 12px;
  font-weight: 550;
}
.member-info span {
  display: block;
  font-size: 10px;
  color: #687b6d;
  margin-top: 3px;
}
.kick-votes {
  font-size: 10px;
  font-weight: 600;
  color: #ae5364;
  background: #fbecee;
  border-radius: 10px;
  padding: 2px 7px;
}
.admin-icon {
  color: #315ee8;
}
.invite-button {
  color: #315ee8;
  font-size: 11px;
  width: 100%;
  border: 1px dashed #cdd5c8;
  border-radius: 7px;
  margin-top: 7px;
}
</style>
