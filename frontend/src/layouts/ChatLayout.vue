<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../features/auth/auth.store.js'
import { useChannelsStore } from '../features/channels/channels.store.js'
import { useMessagesStore } from '../features/chat/messages.store.js'
import ChannelList from '../features/channels/components/ChannelList.vue'
import ChannelDialog from '../features/channels/components/ChannelDialog.vue'
import UserAvatar from '../components/UserAvatar.vue'
import BrandMark from '../components/BrandMark.vue'

const auth = useAuthStore()
const channels = useChannelsStore()
const messages = useMessagesStore()
const router = useRouter()
const quasar = useQuasar()
const drawer = ref(false)
const dialogOpen = ref(false)
const dialogMode = ref('create')
const dialogChannelId = ref(null)
const error = ref('')
const signingOut = ref(false)
function retry() {
  error.value = ''
  channels.initialize()
}
function openDialog(mode) {
  dialogMode.value = mode
  dialogChannelId.value = channels.activeId
  dialogOpen.value = true
}
async function select(id) {
  error.value = ''
  if (quasar.screen.lt.md) drawer.value = false
  try {
    await channels.select(id)
  } catch (cause) {
    error.value = cause.message
  }
}
async function logout() {
  signingOut.value = true
  try {
    await auth.logout()
    channels.reset()
    messages.reset()
    await router.replace({ name: 'login' })
  } catch (cause) {
    error.value = cause.message
  } finally {
    signingOut.value = false
  }
}
onMounted(() => channels.initialize())
</script>
<template>
  <div class="chat-shell">
    <q-layout container view="hHh Lpr fFf" class="chat-layout">
      <q-header class="workspace-header"
        ><q-toolbar class="workspace-toolbar"
          ><q-btn
            flat
            dense
            round
            icon="menu"
            class="mobile-menu"
            aria-label="Toggle channels"
            @click="drawer = !drawer"
          /><div class="header-brand"><BrandMark /></div
          ><button class="workspace-search" @click="openDialog('browse')"
            ><q-icon name="search" size="17px" /><span
              >Find your channel</span
            ></button
          ><q-btn
            flat
            round
            dense
            icon="help_outline"
            aria-label="About this prototype"
            ><q-menu
              ><div class="q-pa-lg" style="max-width: 300px"
                ><strong>About Sideby</strong
                ><p class="text-muted q-mt-sm"
                  >Sideby is a local demo. Your workspace stays in this browser;
                  live collaboration is coming later.</p
                ></div
              ></q-menu
            ></q-btn
          ></q-toolbar
        ></q-header
      >
      <q-drawer
        v-model="drawer"
        show-if-above
        :breakpoint="1023"
        :width="308"
        class="workspace-drawer"
      >
        <div class="navigation-shell"
          ><aside class="workspace-rail" aria-label="Workspace"
            ><button
              class="workspace-tile"
              aria-label="Common room workspace"
              @click="drawer = true"
              ><BrandMark compact /><span class="workspace-indicator" /></button
            ><div class="rail-line" /><q-btn
              flat
              round
              icon="explore"
              aria-label="Browse channels"
              class="rail-button"
              @click="openDialog('browse')"
              ><q-tooltip anchor="center right" self="center left"
                >Explore channels</q-tooltip
              ></q-btn
            ><q-btn
              flat
              round
              icon="add"
              aria-label="Create channel"
              class="rail-button"
              @click="openDialog('create')"
              ><q-tooltip anchor="center right" self="center left"
                >Create channel</q-tooltip
              ></q-btn
            ></aside
          >
          <aside class="channel-sidebar"
            ><div class="workspace-heading"
              ><div><h1>Common room</h1></div
              ><q-btn
                flat
                dense
                round
                icon="edit_square"
                size="sm"
                aria-label="Start a new channel"
                @click="openDialog('create')"
            /></div>
            <q-linear-progress
              v-if="channels.loading"
              indeterminate
              color="primary"
            />
            <div class="sidebar-scroll"
              ><ChannelList
                :channels="channels.channels"
                :active-id="channels.activeId"
                :user-id="auth.user?.id"
                @select="select"
                @create="openDialog('create')"
                @browse="openDialog('browse')"
            /></div>
            <button v-if="auth.user" class="profile-button"
              ><UserAvatar :user="auth.user" :size="34" presence /><span
                class="profile-info"
                ><strong
                  >{{ auth.user.firstName }} {{ auth.user.lastName }}</strong
                ><small>@{{ auth.user.nickName }}</small></span
              ><q-icon name="unfold_more" size="17px" /><q-menu
                anchor="top right"
                self="bottom right"
                ><q-list style="min-width: 230px"
                  ><q-item
                    ><q-item-section
                      ><q-item-label
                        >{{ auth.user.firstName }}
                        {{ auth.user.lastName }}</q-item-label
                      ><q-item-label caption>{{
                        auth.user.email
                      }}</q-item-label></q-item-section
                    ></q-item
                  ><q-separator /><q-item
                    clickable
                    :disable="signingOut || channels.loading"
                    @click="logout"
                    ><q-item-section avatar
                      ><q-icon name="logout" /></q-item-section
                    ><q-item-section>Sign out</q-item-section></q-item
                  ></q-list
                ></q-menu
              ></button
            >
          </aside>
        </div>
      </q-drawer>
      <q-page-container class="chat-page-container"
        ><div class="chat-content"
          ><div
            v-if="channels.error || error"
            class="workspace-error"
            role="alert"
            ><span>{{ channels.error || error }}</span
            ><q-btn flat dense label="Retry" @click="retry" /></div
          ><router-view v-slot="{ Component }"
            ><component
              :is="Component"
              @open-channel-dialog="openDialog" /></router-view></div
      ></q-page-container>
    </q-layout>
    <ChannelDialog
      v-model="dialogOpen"
      :mode="dialogMode"
      :channel-id="dialogChannelId"
    />
  </div>
</template>
<style scoped>
.chat-shell {
  height: 100vh;
  height: 100dvh;
  background: #182421;
}
.chat-layout {
  height: 100%;
  background: #182421;
}
.workspace-header {
  background: #182421;
}
.workspace-toolbar {
  min-height: 66px;
  gap: 22px;
  padding: 0 24px;
}
.header-brand {
  color: #e0f38b;
  width: 260px;
  flex-shrink: 0;
}
.workspace-search {
  height: 37px;
  border: 1px solid #536357;
  background: transparent;
  color: #d5dfd6;
  border-radius: 10px;
  width: min(450px, 48%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  margin-right: auto;
  font-size: 13px;
  cursor: pointer;
}
.workspace-search:hover {
  background: #ffffff0a;
}
.mobile-menu {
  display: none;
}
.workspace-drawer {
  background: #20332d;
  color: #fffefa;
}
.navigation-shell {
  display: flex;
  height: 100%;
}
.workspace-rail {
  width: 68px;
  flex-shrink: 0;
  background: #182421;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 23px;
  gap: 18px;
}
.workspace-tile {
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;
  background: #e0f38b;
  color: #20332d;
  border: 0;
  border-radius: 14px 14px 5px 14px;
  position: relative;
  cursor: pointer;
}
.workspace-tile :deep(svg) {
  width: 28px;
  height: 28px;
}
.workspace-indicator {
  position: absolute;
  width: 3px;
  height: 20px;
  border-radius: 0 4px 4px 0;
  top: 12px;
  left: -13px;
  background: #e0f38b;
}
.rail-line {
  width: 20px;
  height: 1px;
  background: #536357;
  margin: 3px 0;
}
.rail-button {
  color: #bccabe;
}
.channel-sidebar {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #20332d;
}
.workspace-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 18px 17px;
}
.workspace-heading h1 {
  font-size: 19px;
  line-height: 1.3;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.6px;
}
.workspace-heading > .q-btn {
  color: #bbcdbe;
}
.sidebar-scroll {
  overflow-y: auto;
  flex: 1;
}
.profile-button {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 18px;
  width: 100%;
  background: #1b2d26;
  color: #edf2e7;
  border: 0;
  text-align: left;
  cursor: pointer;
}
.profile-info {
  min-width: 0;
  flex: 1;
}
.profile-info strong {
  display: block;
  font-size: 13px;
  font-weight: 500;
}
.profile-info small {
  color: #a4b8a8;
  font-size: 11px;
}
.chat-page-container {
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
}
.chat-content {
  height: calc(100% - 12px);
  margin-right: 12px;
  border-radius: 20px 4px 20px 4px;
  overflow: hidden;
  background: #fffefa;
  display: flex;
  flex-direction: column;
}
.workspace-error {
  padding: 9px 20px;
  background: #fff0f1;
  color: #a14856;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
@media (max-width: 1023px) {
  .mobile-menu {
    display: inline-flex;
  }
  .workspace-toolbar {
    min-height: 62px;
    padding: 0 14px;
    gap: 14px;
  }
  .header-brand {
    width: auto;
  }
  .header-brand :deep(.brand-mark) {
    font-size: 22px;
  }
  .header-brand :deep(svg) {
    width: 28px;
    height: 28px;
  }
  .workspace-search {
    width: auto;
    flex: 1;
  }
  .chat-content {
    margin: 0 6px 6px;
    height: calc(100% - 6px);
    border-radius: 14px 4px 14px 4px;
  }
}
@media (max-width: 540px) {
  .workspace-search {
    justify-content: center;
    flex: none;
    width: 36px;
    padding: 0;
    margin-left: auto;
    margin-right: 0;
  }
  .workspace-search span {
    display: none;
  }
}
</style>
