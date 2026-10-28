import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ExpireChannels extends BaseCommand {
  static commandName = 'channels:expire'
  static description = 'Delete channels with more than 30 days without messages'
  static options: CommandOptions = { startApp: true }

  async run() {
    const { default: ChannelService } = await import('#services/channel_service')
    const count = await new ChannelService().expireInactive()
    this.logger.success(`Expired ${count} channels`)
  }
}
