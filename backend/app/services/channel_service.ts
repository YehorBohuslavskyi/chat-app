import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import { publishChannelEvents, type ChannelEvent } from '#services/channel_events'

export interface ChannelRow {
  id: number
  name: string
  description: string
  type: 'public' | 'private'
  admin_id: number
  created_at: string | Date
  last_message_at: string | Date | number
}

export function domainError(message: string, status: number, code: string): never {
  throw new Exception(message, { status, code })
}

export function isUniqueViolation(error: unknown) {
  const value = error as { code?: string; message?: string }
  return (
    value.code === '23505' ||
    (value.code?.startsWith('SQLITE_CONSTRAINT') && value.message?.includes('UNIQUE constraint'))
  )
}

export default class ChannelService {
  constructor(private now: () => DateTime = () => DateTime.utc()) {}

  private expired(channel: ChannelRow) {
    const time =
      channel.last_message_at instanceof Date
        ? channel.last_message_at.getTime()
        : typeof channel.last_message_at === 'number'
          ? channel.last_message_at
          : DateTime.fromSQL(channel.last_message_at, { zone: 'utc' }).toMillis()
    return time < this.now().minus({ days: 30 }).toMillis()
  }

  private async locked<T>(
    channelId: number,
    action: (
      trx: TransactionClientContract,
      channel: ChannelRow,
      events: ChannelEvent[]
    ) => Promise<T>
  ): Promise<T> {
    const events: ChannelEvent[] = []
    const result = await db.transaction(async (trx) => {
      const channel: ChannelRow | undefined = await trx
        .from('channels')
        .where('id', channelId)
        .forUpdate()
        .first()
      if (!channel) return { missing: true as const }
      if (this.expired(channel)) {
        await trx.from('channels').where('id', channelId).delete()
        events.push({ type: 'channel.deleted', channelId })
        return { missing: true as const }
      }
      return { missing: false as const, value: await action(trx, channel, events) }
    })
    publishChannelEvents(events)
    // Throw after commit so expiry deletion is not rolled back.
    if (result.missing) domainError('Channel not found or expired', 404, 'E_CHANNEL_NOT_FOUND')
    return result.value
  }

  async requireMember(trx: TransactionClientContract, channelId: number, userId: number) {
    const member = await trx
      .from('channel_members')
      .where({ channel_id: channelId, user_id: userId })
      .first()
    if (!member) domainError('Channel membership required', 403, 'E_NOT_MEMBER')
    return member
  }

  requireAdmin(channel: ChannelRow, userId: number) {
    if (channel.admin_id !== userId)
      domainError('Channel administrator required', 403, 'E_NOT_ADMIN')
  }

  // Message writes must use this transaction and update last_message_at within it.
  // Always acquire the channel lock first, before any membership/message locks.
  async withMember<T>(
    channelId: number,
    userId: number,
    action: (trx: TransactionClientContract, channel: ChannelRow) => Promise<T>
  ): Promise<T> {
    return this.locked(channelId, async (trx, channel) => {
      await this.requireMember(trx, channelId, userId)
      return action(trx, channel)
    })
  }

  async create(
    userId: number,
    input: { name: string; type: 'public' | 'private'; description?: string }
  ) {
    // Release an expired name before attempting unique creation.
    const existing = await db.from('channels').where('name', input.name).first()
    if (existing) await this.expireOne(existing.id)
    const events: ChannelEvent[] = []
    const channel = await db.transaction(async (trx) => {
      const timestamp = this.now().toJSDate()
      await trx.table('channels').insert({
        name: input.name,
        type: input.type,
        description: input.description || '',
        admin_id: userId,
        created_at: timestamp,
        last_message_at: timestamp,
      })
      const created = await trx.from('channels').where('name', input.name).firstOrFail()
      await trx.table('channel_members').insert({
        channel_id: created.id,
        user_id: userId,
        joined_at: timestamp,
        invitation_seen: true,
      })
      events.push({ type: 'channel.created', channelId: created.id, userId })
      return created as ChannelRow
    })
    publishChannelEvents(events)
    return channel
  }

  async join(userId: number, name: string, type: 'public' | 'private' = 'public') {
    let existing = await db.from('channels').where('name', name).first()
    if (existing && (await this.expireOne(existing.id))) existing = undefined
    if (!existing) {
      try {
        return await this.create(userId, { name, type })
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        // A concurrent creator won the unique name; reapply access rules.
        existing = await db.from('channels').where('name', name).first()
        if (!existing) throw error
      }
    }
    return this.locked(existing.id, async (trx, channel, events) => {
      const banned = await trx
        .from('channel_bans')
        .where({ channel_id: channel.id, user_id: userId })
        .first()
      if (banned) domainError('You are banned from this channel', 403, 'E_BANNED')
      const member = await trx
        .from('channel_members')
        .where({ channel_id: channel.id, user_id: userId })
        .first()
      if (member) return channel
      if (channel.type === 'private')
        domainError('An invitation is required', 403, 'E_PRIVATE_CHANNEL')
      await trx.table('channel_members').insert({
        channel_id: channel.id,
        user_id: userId,
        joined_at: this.now().toJSDate(),
        invitation_seen: true,
      })
      events.push({ type: 'member.added', channelId: channel.id, userId })
      return channel
    })
  }

  async list(userId: number) {
    const memberships = await db
      .from('channel_members')
      .where('user_id', userId)
      .select('channel_id')
    for (const member of memberships) await this.expireOne(member.channel_id)
    return db
      .from('channels as c')
      .join('channel_members as m', 'c.id', 'm.channel_id')
      .where('m.user_id', userId)
      .select('c.*', 'm.invited_at', 'm.invitation_seen')
      .orderBy('m.invitation_seen', 'asc')
      .orderBy('m.invited_at', 'desc')
      .orderBy('c.name', 'asc')
  }

  async discover(userId: number, query: string) {
    const rows = await db
      .from('channels')
      .where('type', 'public')
      .where('last_message_at', '>=', this.now().minus({ days: 30 }).toJSDate())
      .where('name', 'like', `%${query}%`)
      .whereNotIn('id', db.from('channel_bans').where('user_id', userId).select('channel_id'))
      .orderBy('name')
      .limit(50)
    const memberships = await db
      .from('channel_members')
      .where('user_id', userId)
      .select('channel_id')
    const mine = new Set(memberships.map((member) => member.channel_id))
    return rows.map((channel) => ({ ...channel, isMember: mine.has(channel.id) }))
  }

  async seen(channelId: number, userId: number) {
    return this.withMember(channelId, userId, async (trx) => {
      await trx
        .from('channel_members')
        .where({ channel_id: channelId, user_id: userId })
        .update({ invitation_seen: true })
      return { seen: true }
    })
  }

  async members(channelId: number, userId: number) {
    return this.withMember(channelId, userId, async (trx, channel) => {
      const users = await trx
        .from('users as u')
        .join('channel_members as m', 'u.id', 'm.user_id')
        .where('m.channel_id', channelId)
        .select('u.id', 'u.nickname', 'u.first_name', 'u.last_name')
        .orderBy('u.nickname')
      return users.map((user) => ({
        id: user.id,
        nickname: user.nickname,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.id === channel.admin_id,
      }))
    })
  }

  async invite(channelId: number, actorId: number, nickname: string) {
    return this.locked(channelId, async (trx, channel, events) => {
      await this.requireMember(trx, channelId, actorId)
      if (channel.type === 'private') this.requireAdmin(channel, actorId)
      const target = await this.target(trx, nickname)
      const banned = await trx
        .from('channel_bans')
        .where({ channel_id: channelId, user_id: target.id })
        .first()
      if (banned) {
        this.requireAdmin(channel, actorId)
        await trx.from('channel_bans').where({ channel_id: channelId, user_id: target.id }).delete()
        await trx.from('kick_votes').where({ channel_id: channelId, target_id: target.id }).delete()
      }
      const existing = await trx
        .from('channel_members')
        .where({ channel_id: channelId, user_id: target.id })
        .first()
      if (!existing) {
        const now = this.now().toJSDate()
        await trx.table('channel_members').insert({
          channel_id: channelId,
          user_id: target.id,
          joined_at: now,
          invited_at: now,
          invitation_seen: false,
        })
        events.push({ type: 'member.added', channelId, userId: target.id })
      }
      return { userId: target.id, invited: !existing, restored: !!banned }
    })
  }

  private async target(trx: TransactionClientContract, nickname: string) {
    const user = await trx
      .from('users')
      .where('nickname', nickname)
      .select('id', 'nickname')
      .first()
    if (!user) domainError('User not found', 404, 'E_USER_NOT_FOUND')
    return user
  }

  private protectTarget(channel: ChannelRow, actorId: number, targetId: number) {
    if (targetId === actorId || targetId === channel.admin_id) {
      domainError('Cannot moderate yourself or the administrator', 403, 'E_PROTECTED_MEMBER')
    }
  }

  private async removeMember(
    trx: TransactionClientContract,
    channelId: number,
    userId: number,
    events: ChannelEvent[]
  ) {
    await trx.from('channel_members').where({ channel_id: channelId, user_id: userId }).delete()
    // Votes count current members and reset when a target leaves or is removed.
    await trx
      .from('kick_votes')
      .where('channel_id', channelId)
      .where((query) => query.where('voter_id', userId).orWhere('target_id', userId))
      .delete()
    events.push({ type: 'member.removed', channelId, userId })
  }

  async revoke(channelId: number, actorId: number, nickname: string) {
    return this.locked(channelId, async (trx, channel, events) => {
      await this.requireMember(trx, channelId, actorId)
      this.requireAdmin(channel, actorId)
      if (channel.type !== 'private')
        domainError('Revoke is for private channels', 422, 'E_CHANNEL_TYPE')
      const target = await this.target(trx, nickname)
      this.protectTarget(channel, actorId, target.id)
      await this.requireMember(trx, channelId, target.id)
      await this.removeMember(trx, channelId, target.id, events)
      return { removed: true }
    })
  }

  async kick(channelId: number, actorId: number, nickname: string) {
    return this.locked(channelId, async (trx, channel, events) => {
      await this.requireMember(trx, channelId, actorId)
      if (channel.type !== 'public')
        domainError('Kick is for public channels', 422, 'E_CHANNEL_TYPE')
      const target = await this.target(trx, nickname)
      this.protectTarget(channel, actorId, target.id)
      await this.requireMember(trx, channelId, target.id)
      let votes = 0
      if (actorId !== channel.admin_id) {
        await trx
          .table('kick_votes')
          .insert({
            channel_id: channelId,
            target_id: target.id,
            voter_id: actorId,
            created_at: this.now().toJSDate(),
          })
          .onConflict(['channel_id', 'target_id', 'voter_id'])
          .ignore()
        const count = await trx
          .from('kick_votes')
          .where({ channel_id: channelId, target_id: target.id })
          .count('* as total')
          .first()
        votes = Number(count!.total)
      }
      const banned = actorId === channel.admin_id || votes >= 3
      if (banned) {
        await trx.table('channel_bans').insert({
          channel_id: channelId,
          user_id: target.id,
          reason: actorId === channel.admin_id ? 'admin' : 'votes',
          banned_at: this.now().toJSDate(),
        })
        await this.removeMember(trx, channelId, target.id, events)
      }
      return { banned, votes }
    })
  }

  async leave(channelId: number, userId: number, deleteOnly = false) {
    return this.locked(channelId, async (trx, channel, events) => {
      await this.requireMember(trx, channelId, userId)
      if (deleteOnly) this.requireAdmin(channel, userId)
      if (channel.admin_id === userId) {
        await trx.from('channels').where('id', channelId).delete()
        events.push({ type: 'channel.deleted', channelId })
        return { deleted: true }
      }
      await this.removeMember(trx, channelId, userId, events)
      return { deleted: false }
    })
  }

  async expireOne(channelId: number) {
    const events: ChannelEvent[] = []
    const deleted = await db.transaction(async (trx) => {
      const channel = await trx.from('channels').where('id', channelId).forUpdate().first()
      if (!channel || !this.expired(channel)) return false
      await trx.from('channels').where('id', channelId).delete()
      events.push({ type: 'channel.deleted', channelId })
      return true
    })
    publishChannelEvents(events)
    return deleted
  }

  async expireInactive() {
    let cursor = 0
    let deleted = 0
    while (true) {
      const rows = await db
        .from('channels')
        .where('id', '>', cursor)
        .where('last_message_at', '<', this.now().minus({ days: 30 }).toJSDate())
        .orderBy('id')
        .limit(100)
        .select('id')
      if (!rows.length) return deleted
      for (const row of rows) {
        if (await this.expireOne(row.id)) deleted++
        cursor = row.id
      }
    }
  }
}
