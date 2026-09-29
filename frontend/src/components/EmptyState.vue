<script setup>
defineProps({
  icon: { type: String, default: 'forum' },
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
</script>
<template>
  <div class="empty-state"
    ><q-icon :name="icon" size="30px" /><h2>{{ title }}</h2
    ><p>{{ description }}</p
    ><slot
  /></div>
</template>
<style scoped>
.empty-state {
  padding: 48px 24px;
  text-align: center;
  color: #7c788c;
}
.empty-state h2 {
  font-size: 20px;
  line-height: 1.4;
  color: #302c40;
  font-weight: 650;
  margin: 16px 0 8px;
}
.empty-state p {
  max-width: 380px;
  margin: 0 auto 20px;
  line-height: 1.7;
}
</style>
