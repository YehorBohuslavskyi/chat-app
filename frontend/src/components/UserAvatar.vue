<script setup>
defineProps({
  user: { type: Object, required: true },
  size: { type: Number, default: 38 },
  presence: Boolean
})
</script>

<template>
  <span
    class="avatar"
    :style="{
      '--avatar-color': user.color || '#7061c7',
      width: `${size}px`,
      height: `${size}px`
    }"
    :aria-label="`${user.firstName} ${user.lastName}${presence ? `, ${user.status}` : ''}`"
  >
    {{ user.firstName?.[0] }}{{ user.lastName?.[0] }}
    <span v-if="presence" class="presence" :class="user.status" />
  </span>
</template>

<style scoped>
.avatar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: var(--avatar-color);
  color: #fffefa;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.presence {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 11px;
  height: 11px;
  border: 2px solid #fffefa;
  border-radius: 50%;
  background: #9498a5;
}
.presence.online {
  background: #38a57e;
}
.presence.dnd {
  background: #d96d75;
}
</style>
