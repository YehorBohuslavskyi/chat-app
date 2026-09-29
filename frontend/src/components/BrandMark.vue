<script setup>
defineProps({ compact: Boolean })
</script>
<template>
  <span class="brand-mark" aria-label="Sideby">
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M5 8h18v16H13l-8 8V8Z" fill="currentColor" />
      <path d="M35 32H17V16h10l8-8v24Z" fill="currentColor" opacity=".48" />
    </svg>
    <span v-if="!compact">sideby</span>
  </span>
</template>
<style scoped>
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  font-size: 27px;
  font-weight: 750;
  letter-spacing: -1.5px;
  line-height: 1;
}
svg {
  width: 35px;
  height: 35px;
  flex-shrink: 0;
}
</style>
