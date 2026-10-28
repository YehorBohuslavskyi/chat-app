import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
const ChannelsController = () => import('#controllers/channels_controller')

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('channels', [ChannelsController, 'index'])
        router.get('channels/discover', [ChannelsController, 'discover'])
        router.post('channels', [ChannelsController, 'store'])
        router.post('channels/join', [ChannelsController, 'join'])
        router.get('channels/:id/members', [ChannelsController, 'members'])
        router.post('channels/:id/seen', [ChannelsController, 'seen'])
        router.post('channels/:id/invite', [ChannelsController, 'invite'])
        router.post('channels/:id/revoke', [ChannelsController, 'revoke'])
        router.post('channels/:id/kick', [ChannelsController, 'kick'])
        router.post('channels/:id/leave', [ChannelsController, 'leave'])
        router.delete('channels/:id', [ChannelsController, 'destroy'])
        router.post('commands', [ChannelsController, 'command'])
      })
      .use(middleware.auth())
  })
  .prefix('/api/v1')
