<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../auth.store.js'
import { demoCredentials } from '../../../services/mock/fixtures.js'

const props = defineProps({ register: Boolean })
const auth = useAuthStore()
const router = useRouter()
const form = reactive({
  firstName: '',
  lastName: '',
  nickName: '',
  email: '',
  password: '',
  confirmation: ''
})
const busy = ref(false)
const error = ref('')
const showPassword = ref(false)
const required = value => !!value?.trim() || 'This field is required'

async function submit(demo = false) {
  if (busy.value) return
  error.value = ''
  if (props.register && form.password !== form.confirmation) {
    error.value = 'Passwords must match.'
    return
  }
  busy.value = true
  try {
    if (props.register) await auth.register(form)
    else await auth.login(demo ? demoCredentials : form)
    await router.replace({ name: 'chat' })
  } catch (cause) {
    error.value = cause.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="account-form"
    ><h1>{{ register ? 'Make room for yourself.' : 'Back in the mix.' }}</h1
    ><p class="intro">{{
      register
        ? 'Choose a name your people will know.'
        : 'Your channels are right where you left them.'
    }}</p>
    <q-form @submit="submit(false)" class="q-gutter-y-sm">
      <div v-if="register" class="name-fields"
        ><q-input
          v-model="form.firstName"
          outlined
          label="First name"
          autocomplete="given-name"
          :rules="[required]"
          maxlength="60" /><q-input
          v-model="form.lastName"
          outlined
          label="Last name"
          autocomplete="family-name"
          :rules="[required]"
          maxlength="60"
      /></div>
      <q-input
        v-if="register"
        v-model="form.nickName"
        outlined
        label="Nickname"
        prefix="@"
        autocomplete="username"
        :rules="[
          required,
          value =>
            /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/.test(value) ||
            'Use 2–32 letters, numbers, hyphens, or underscores'
        ]"
      />
      <q-input
        v-model="form.email"
        outlined
        type="email"
        label="Email address"
        autocomplete="email"
        :rules="[
          required,
          value =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a valid email'
        ]"
      />
      <q-input
        v-model="form.password"
        outlined
        :type="showPassword ? 'text' : 'password'"
        label="Password"
        :autocomplete="register ? 'new-password' : 'current-password'"
        :rules="[value => value.length >= 8 || 'Use at least 8 characters']"
        ><template #append
          ><q-btn
            flat
            round
            dense
            :icon="showPassword ? 'visibility_off' : 'visibility'"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword" /></template
      ></q-input>
      <q-input
        v-if="register"
        v-model="form.confirmation"
        outlined
        type="password"
        label="Confirm password"
        autocomplete="new-password"
        :rules="[value => value === form.password || 'Passwords must match']"
      />
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <q-btn
        unelevated
        color="primary"
        class="full-width auth-submit"
        type="submit"
        :label="register ? 'Create account' : 'Sign in'"
        :loading="busy"
        icon-right="arrow_forward"
        no-caps
      />
    </q-form>
    <template v-if="!register"
      ><div class="divider"><span>Just looking?</span></div
      ><q-btn
        outline
        color="primary"
        class="full-width auth-submit"
        no-caps
        label="Try Sideby"
        icon="north_east"
        :disable="busy"
        @click="submit(true)"
    /></template>
    <p class="switch-form"
      >{{ register ? 'Have a spot here?' : 'First time here?' }}
      <router-link :to="{ name: register ? 'login' : 'register' }">{{
        register ? 'Sign in' : 'Create an account'
      }}</router-link></p
    >
  </div>
</template>
<style scoped>
.account-form {
  width: 100%;
  max-width: 390px;
}
h1 {
  font-size: 36px;
  line-height: 1.12;
  letter-spacing: -1.5px;
  font-weight: 650;
  color: #20332d;
  margin: 0 0 14px;
}
.intro {
  color: #62756a;
  margin-bottom: 32px;
  font-size: 14px;
}
.name-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.auth-submit {
  min-height: 48px;
  border-radius: 12px;
  font-weight: 600;
}
.divider {
  margin: 24px 0 12px;
  color: #65766a;
  font-size: 13px;
}
.switch-form {
  margin: 27px 0 0;
  font-size: 13px;
  color: #62756a;
}
.switch-form a {
  color: #315ee8;
  font-weight: 600;
  margin-left: 5px;
  text-underline-offset: 4px;
}
</style>
