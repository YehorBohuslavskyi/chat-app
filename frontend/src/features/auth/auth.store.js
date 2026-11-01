import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspaceService } from '../../services/index.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(workspaceService.sessionUser())
  const initialized = ref(false)
  const sessionError = ref('')
  let restoring
  let revision = 0
  workspaceService.onSessionExpired?.(() => {
    revision++
    user.value = null
    initialized.value = true
  })
  async function initialize() {
    if (initialized.value) return
    if (restoring) return restoring
    const ticket = revision
    sessionError.value = ''
    restoring = (async () => {
      try {
        const restored = workspaceService.restoreSession
          ? await workspaceService.restoreSession()
          : workspaceService.sessionUser()
        if (ticket === revision) {
          user.value = restored
          initialized.value = true
        }
      } catch (cause) {
        sessionError.value = cause.message
      } finally {
        restoring = null
      }
    })()
    return restoring
  }
  async function login(input) {
    user.value = await workspaceService.login(input)
    revision++
    initialized.value = true
    sessionError.value = ''
  }
  async function register(input) {
    user.value = await workspaceService.register(input)
    revision++
    initialized.value = true
    sessionError.value = ''
  }

  async function setStatus(status) {
    user.value = await workspaceService.setStatus(status)
  }
  async function setNotificationMode(mode) {
    user.value = await workspaceService.setNotificationMode(mode)
  }
  async function logout() {
    await workspaceService.logout()
    user.value = null
  }
  return {
    user,
    initialized,
    sessionError,
    initialize,
    login,
    register,
    setStatus,
    setNotificationMode,
    logout
  }
})
