<script setup>
import BrandMark from '../components/BrandMark.vue'
</script>
<template>
  <main class="missing-page">
    <BrandMark />
    <div class="missing-content">
      <span class="missing-number" aria-hidden="true">404</span>
      <h1>This conversation took a wrong turn.</h1>
      <q-btn
        color="primary"
        unelevated
        to="/chat"
        label="Back to your channels"
        icon-right="arrow_forward"
        no-caps
      />
    </div>
  </main>
</template>
<style scoped>
.missing-page {
  min-height: 100dvh;
  background: #f6f5f0;
  color: #20332d;
  padding: 35px;
  display: flex;
  flex-direction: column;
}
.missing-content {
  margin: auto;
  text-align: center;
  max-width: 560px;
  padding: 35px 0;
}
.missing-number {
  display: block;
  font-size: clamp(110px, 20vw, 220px);
  font-weight: 700;
  letter-spacing: -0.08em;
  line-height: 1;
  color: #315ee8;
}
h1 {
  font-size: clamp(25px, 4vw, 38px);
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -1px;
  margin: 25px 0 35px;
}
.q-btn {
  min-height: 48px;
  border-radius: 12px;
}
</style>
