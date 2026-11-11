import type { HttpContext } from '@adonisjs/core/http'
import { domainError } from '#services/channel_service'
import MessageService from '#services/message_service'
import { historyValidator, sendMessageValidator } from '#validators/message'

const messages = new MessageService()

function channelId(ctx: HttpContext) {
  const id = Number(ctx.params.id)
  if (!Number.isSafeInteger(id) || id < 1)
    domainError('Invalid channel ID', 422, 'E_VALIDATION_ERROR')
  return id
}

export default class MessagesController {
  async index(ctx: HttpContext) {
    const { before, after, limit } = await historyValidator.validate(ctx.request.qs())
    if (before !== undefined && after !== undefined)
      domainError('Use either before or after, not both', 422, 'E_VALIDATION_ERROR')
    const result = await messages.history(channelId(ctx), ctx.auth.user!.id, {
      before,
      after,
      limit: limit ?? 20,
    })
    return { data: result }
  }

  async store(ctx: HttpContext) {
    const { body } = await ctx.request.validateUsing(sendMessageValidator)
    const message = await messages.send(channelId(ctx), ctx.auth.user!.id, body)
    return ctx.response.created({ data: message })
  }
}
