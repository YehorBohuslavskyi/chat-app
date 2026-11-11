import { DateTime } from 'luxon'
import ChannelService from '#services/channel_service'

// Same rule as frontend/src/features/chat/utils/mentions.js, so both sides agree on mentions.
const MENTION = /(?<![\w@])@([a-zA-Z0-9_-]+)/g

export function mentionedNicknames(body: string) {
  return [...new Set([...body.matchAll(MENTION)].map((match) => match[1].toLowerCase()))]
}

interface MessageRow {
  id: number
  channel_id: number
  sender_id: number
  body: string
  created_at: Date | string | number
  nickname: string
  first_name: string
  last_name: string
}

function toIso(value: Date | string | number) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  return DateTime.fromSQL(value, { zone: 'utc' }).toISO() ?? value
}

export default class MessageService {
  constructor(
    private channels = new ChannelService(),
    private now: () => DateTime = () => DateTime.utc()
  ) {}

  // Without a cursor: the newest `limit` messages. `before`: older page. `after`: catch-up.
  // Items are always returned oldest first.
  async history(
    channelId: number,
    userId: number,
    { before, after, limit }: { before?: number; after?: number; limit: number }
  ) {
    return this.channels.withMember(channelId, userId, async (trx) => {
      const query = trx
        .from('messages as msg')
        .join('users as u', 'u.id', 'msg.sender_id')
        .where('msg.channel_id', channelId)
        .select(
          'msg.id',
          'msg.channel_id',
          'msg.sender_id',
          'msg.body',
          'msg.created_at',
          'u.nickname',
          'u.first_name',
          'u.last_name'
        )
        .limit(limit + 1)
      if (before !== undefined) query.where('msg.id', '<', before)
      if (after !== undefined) query.where('msg.id', '>', after).orderBy('msg.id', 'asc')
      else query.orderBy('msg.id', 'desc')

      const rows: MessageRow[] = await query
      const hasMore = rows.length > limit
      const page = rows.slice(0, limit)
      if (after === undefined) page.reverse()

      const ids = page.map((row) => row.id)
      const mentionRows: { message_id: number; user_id: number }[] = ids.length
        ? await trx.from('message_mentions').whereIn('message_id', ids)
        : []
      return {
        items: page.map((row) => ({
          id: row.id,
          channelId: row.channel_id,
          senderId: row.sender_id,
          body: row.body,
          createdAt: toIso(row.created_at),
          sender: {
            id: row.sender_id,
            nickname: row.nickname,
            firstName: row.first_name,
            lastName: row.last_name,
          },
          mentions: mentionRows
            .filter((mention) => mention.message_id === row.id)
            .map((mention) => mention.user_id),
        })),
        hasMore,
      }
    })
  }

  async send(channelId: number, senderId: number, body: string) {
    // withMember locks the channel, rejects expired channels and non-members,
    // so the message and last_message_at commit together or not at all.
    return this.channels.withMember(channelId, senderId, async (trx) => {
      const createdAt = this.now().toJSDate()
      const [inserted] = await trx
        .table('messages')
        .insert({ channel_id: channelId, sender_id: senderId, body, created_at: createdAt })
        .returning('id')
      const id = Number(typeof inserted === 'object' ? inserted.id : inserted)

      // Only current channel members can be mentioned; mentioning yourself is ignored.
      const nicknames = mentionedNicknames(body)
      const mentioned: { id: number }[] = nicknames.length
        ? await trx
            .from('users as u')
            .join('channel_members as m', 'u.id', 'm.user_id')
            .where('m.channel_id', channelId)
            .whereIn('u.nickname', nicknames)
            .whereNot('u.id', senderId)
            .select('u.id')
        : []
      if (mentioned.length) {
        await trx
          .table('message_mentions')
          .insert(mentioned.map((user) => ({ message_id: id, user_id: user.id })))
      }

      await trx.from('channels').where('id', channelId).update({ last_message_at: createdAt })

      const sender = await trx
        .from('users')
        .where('id', senderId)
        .select('id', 'nickname', 'first_name', 'last_name')
        .firstOrFail()
      return {
        id,
        channelId,
        senderId,
        body,
        createdAt: createdAt.toISOString(),
        sender: {
          id: sender.id,
          nickname: sender.nickname,
          firstName: sender.first_name,
          lastName: sender.last_name,
        },
        mentions: mentioned.map((user) => user.id),
      }
    })
  }
}
