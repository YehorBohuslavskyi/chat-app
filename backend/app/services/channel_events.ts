import { EventEmitter } from 'node:events'
import logger from '@adonisjs/core/services/logger'

export type ChannelEvent =
  | { type: 'channel.created'; channelId: number; userId: number }
  | { type: 'channel.deleted'; channelId: number }
  | { type: 'member.added'; channelId: number; userId: number }
  | { type: 'member.removed'; channelId: number; userId: number }

// Teammate integration: subscribe to 'change' and publish to authorized clients.
// These notifications run only after commit; reconnect must reconcile DB state.
export const channelEvents = new EventEmitter({ captureRejections: true })
channelEvents.on('error', (error) => logger.error({ err: error }, 'Channel event listener failed'))

export function publishChannelEvents(events: ChannelEvent[]) {
  for (const event of events) {
    try {
      channelEvents.emit('change', event)
    } catch (error) {
      logger.error({ err: error }, 'Channel event listener failed after commit')
    }
  }
}
