<script setup>
import BrandMark from '../components/BrandMark.vue'
</script>
<template>
  <main class="auth-layout">
    <section class="auth-story" aria-label="Sideby">
      <router-link class="wordmark" :to="{ name: 'login' }"
        ><BrandMark
      /></router-link>
      <div class="story-content">
        <h1>Your ideas need<br /><em>a few accomplices.</em></h1>
        <p>Pull up a channel. Put something into motion.</p>
        <div class="conversation-art" aria-hidden="true"
          ><div class="art-shape art-first"
            ><span>What if<span class="dots">…</span></span></div
          ><div class="art-shape art-second"
            ><span>Let’s try it.</span><span class="art-arrow">↗</span></div
          ></div
        >
      </div>
    </section>
    <section class="auth-form-region"><router-view /></section>
  </main>
</template>
<style scoped>
.auth-layout {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1.08fr 1fr;
  background: #f6f5f0;
}
.auth-story {
  padding: 40px 9%;
  display: flex;
  flex-direction: column;
  background: #20332d;
  color: #f6f5f0;
  overflow: hidden;
}
.wordmark {
  color: #e0f38b;
  text-decoration: none;
  align-self: flex-start;
}
.story-content {
  margin: auto 0;
  padding: 65px 0 35px;
}
h1 {
  font-size: clamp(37px, 4.2vw, 65px);
  line-height: 1.05;
  font-weight: 650;
  letter-spacing: -2.6px;
  margin: 0;
}
h1 em {
  color: #e0f38b;
  font-weight: 450;
  font-style: normal;
}
.story-content > p {
  color: #c0cdc3;
  line-height: 1.7;
  font-size: 16px;
  margin: 26px 0 0;
  max-width: 290px;
}
.conversation-art {
  position: relative;
  height: 240px;
  max-width: 430px;
  margin-top: 45px;
}
.art-shape {
  position: absolute;
  padding: 30px;
  width: 66%;
  height: 145px;
  display: flex;
  align-items: center;
  font-size: clamp(25px, 2.6vw, 39px);
  font-weight: 600;
  letter-spacing: -1.4px;
}
.art-first {
  background: #315ee8;
  color: #fffefa;
  left: 0;
  top: 0;
  border-radius: 30px 30px 4px 30px;
  transform: rotate(-7deg);
}
.art-second {
  background: #e0f38b;
  color: #20332d;
  right: 0;
  bottom: 0;
  border-radius: 4px 30px 30px 30px;
  transform: rotate(5deg);
  justify-content: space-between;
}
.art-arrow {
  font-size: 42px;
  font-weight: 400;
}
.dots {
  letter-spacing: 2px;
}
.auth-form-region {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
}
@media (max-width: 800px) {
  .auth-layout {
    grid-template-columns: 1fr;
  }
  .auth-story {
    padding: 24px;
  }
  .story-content {
    padding: 35px 0 16px;
    margin: 0;
  }
  h1 {
    font-size: 38px;
    letter-spacing: -1.7px;
  }
  .story-content > p {
    display: none;
  }
  .conversation-art {
    display: none;
  }
  .auth-form-region {
    padding: 38px 24px;
  }
}
@media (max-height: 780px) and (min-width: 801px) {
  .story-content {
    padding: 35px 0;
  }
  .conversation-art {
    height: 190px;
    margin-top: 30px;
  }
  .art-shape {
    height: 120px;
  }
}
</style>
