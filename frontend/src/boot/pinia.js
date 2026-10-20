import { defineBoot } from '#q-app'
import { createPinia } from 'pinia'
import { useAuthStore } from '../features/auth/auth.store.js'

export default defineBoot(({ app, router }) => {
  const pinia = createPinia()
  app.use(pinia)
  router.beforeEach(to => {
    const auth = useAuthStore(pinia)
    if (to.meta.requiresAuth && !auth.user) return { name: 'login' }
    if (to.meta.guestOnly && auth.user) return { name: 'chat' }
  })
})
