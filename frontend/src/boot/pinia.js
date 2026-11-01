import { defineBoot } from '#q-app'
import { createPinia } from 'pinia'
import { useAuthStore } from '../features/auth/auth.store.js'
import { watch } from 'vue'
import { useChannelsStore } from '../features/channels/channels.store.js'
import { useMessagesStore } from '../features/chat/messages.store.js'
import { useTypingStore } from '../features/chat/typing.store.js'
import { useNotificationsStore } from '../features/notifications/notifications.store.js'

export default defineBoot(({ app, router }) => {
  const pinia = createPinia()
  app.use(pinia)
  const auth = useAuthStore(pinia)
  watch(
    () => auth.user?.id,
    (id, previous) => {
      if (id === previous) return
      useChannelsStore(pinia).reset()
      useMessagesStore(pinia).reset()
      useTypingStore(pinia).reset()
      useNotificationsStore(pinia).stop()
      if (!id && router.currentRoute.value.meta.requiresAuth)
        router.replace({ name: 'login' })
    },
    { flush: 'sync' }
  )
  router.beforeEach(async to => {
    const auth = useAuthStore(pinia)
    await auth.initialize()
    if (to.meta.requiresAuth && !auth.user) return { name: 'login' }
    if (to.meta.guestOnly && auth.user) return { name: 'chat' }
  })
})
