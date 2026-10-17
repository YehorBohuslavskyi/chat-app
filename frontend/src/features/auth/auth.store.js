import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspaceService } from '../../services/index.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(workspaceService.sessionUser())
  async function login(input) {
    user.value = await workspaceService.login(input)
  }
  async function register(input) {
    user.value = await workspaceService.register(input)
  }
  // The service returns the updated user, so avatars and checks re-render.
  async function setStatus(status) {
    user.value = await workspaceService.setStatus(status)
  }
  async function logout() {
    await workspaceService.logout()
    user.value = null
  }
  return { user, login, register, setStatus, logout }
})
