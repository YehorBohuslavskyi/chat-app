import type { HttpContext } from '@adonisjs/core/http'
import ChannelService, { domainError, type ChannelRow } from '#services/channel_service'
import {
  createChannelValidator,
  joinChannelValidator,
  nicknameValidator,
  commandValidator,
} from '#validators/channel'

const channels = new ChannelService()

function channelDto(
  row: ChannelRow & { invited_at?: unknown; invitation_seen?: boolean | number }
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    adminId: row.admin_id,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    ...(row.invitation_seen !== undefined
      ? {
          invitedAt: row.invited_at,
          invitationSeen: !!row.invitation_seen,
        }
      : {}),
  }
}

function channelId(ctx: HttpContext) {
  const id = Number(ctx.params.id)
  if (!Number.isSafeInteger(id) || id < 1)
    domainError('Invalid channel ID', 422, 'E_VALIDATION_ERROR')
  return id
}

export default class ChannelsController {
  async discover({ auth, request }: HttpContext) {
    const query = String(request.input('q', '')).trim().toLowerCase()
    if (query.length > 32)
      domainError('Search must be at most 32 characters', 422, 'E_SEARCH_LENGTH')
    const rows = await channels.discover(auth.user!.id, query)
    return { data: rows.map((row) => ({ ...channelDto(row), isMember: row.isMember })) }
  }
  async index({ auth }: HttpContext) {
    const rows = await channels.list(auth.user!.id)
    return { data: rows.map(channelDto) }
  }

  async store({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(createChannelValidator)
    return response.created({ data: channelDto(await channels.create(auth.user!.id, input)) })
  }

  async join({ auth, request }: HttpContext) {
    const { name, type } = await request.validateUsing(joinChannelValidator)
    return { data: channelDto(await channels.join(auth.user!.id, name, type)) }
  }

  async members(ctx: HttpContext) {
    return { data: await channels.members(channelId(ctx), ctx.auth.user!.id) }
  }

  async seen(ctx: HttpContext) {
    return { data: await channels.seen(channelId(ctx), ctx.auth.user!.id) }
  }

  async invite(ctx: HttpContext) {
    const { nickname } = await ctx.request.validateUsing(nicknameValidator)
    return { data: await channels.invite(channelId(ctx), ctx.auth.user!.id, nickname) }
  }

  async revoke(ctx: HttpContext) {
    const { nickname } = await ctx.request.validateUsing(nicknameValidator)
    return { data: await channels.revoke(channelId(ctx), ctx.auth.user!.id, nickname) }
  }

  async kick(ctx: HttpContext) {
    const { nickname } = await ctx.request.validateUsing(nicknameValidator)
    return { data: await channels.kick(channelId(ctx), ctx.auth.user!.id, nickname) }
  }

  async leave(ctx: HttpContext) {
    return { data: await channels.leave(channelId(ctx), ctx.auth.user!.id) }
  }

  async destroy(ctx: HttpContext) {
    return { data: await channels.leave(channelId(ctx), ctx.auth.user!.id, true) }
  }

  async command({ auth, request }: HttpContext) {
    const input = await request.validateUsing(commandValidator)
    const [command, ...args] = input.command.split(/\s+/)
    const userId = auth.user!.id
    if (command === '/join') {
      if (args.length < 1 || args.length > 2 || (args[1] && args[1] !== 'private')) {
        domainError('Usage: /join channelName [private]', 422, 'E_COMMAND_SYNTAX')
      }
      const validated = await joinChannelValidator.validate({
        name: args[0],
        type: args[1] || 'public',
      })
      return { data: channelDto(await channels.join(userId, validated.name, validated.type)) }
    }
    if (!['/invite', '/revoke', '/kick', '/quit', '/cancel', '/list'].includes(command)) {
      domainError('Unknown command', 422, 'E_UNKNOWN_COMMAND')
    }
    if (!input.channelId) domainError('Select a channel first', 422, 'E_CHANNEL_REQUIRED')
    if (['/invite', '/revoke', '/kick'].includes(command)) {
      if (args.length !== 1) domainError(`Usage: ${command} nickname`, 422, 'E_COMMAND_SYNTAX')
      const { nickname } = await nicknameValidator.validate({ nickname: args[0] })
      if (command === '/invite')
        return { data: await channels.invite(input.channelId, userId, nickname) }
      if (command === '/revoke')
        return { data: await channels.revoke(input.channelId, userId, nickname) }
      return { data: await channels.kick(input.channelId, userId, nickname) }
    }
    if (args.length) domainError(`Usage: ${command}`, 422, 'E_COMMAND_SYNTAX')
    if (command === '/list') return { data: await channels.members(input.channelId, userId) }
    return { data: await channels.leave(input.channelId, userId, command === '/quit') }
  }
}
