import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ChannelService from '#services/channel_service'
import { channelEvents, type ChannelEvent } from '#services/channel_events'
import { DateTime } from 'luxon'

let sequence = 0
async function user() {
  const number = ++sequence
  return User.create({
    firstName: 'Test',
    lastName: 'Member',
    fullName: 'Test Member',
    nickname: `member-${number}`,
    email: `member-${number}@example.com`,
    password: 'test-password',
  })
}

test.group('Backend foundation', (group) => {
  group.setup(() => testUtils.db().migrate())
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('public discovery hides private, expired and banned channels', async ({
    client,
    assert,
  }) => {
    const service = new ChannelService()
    const admin = await user()
    const member = await user()
    await service.create(admin.id, { name: 'discover-private', type: 'private' })
    const pub = await service.create(admin.id, { name: 'discover-public', type: 'public' })
    const expired = await service.create(admin.id, { name: 'discover-expired', type: 'public' })
    await db
      .from('channels')
      .where('id', expired.id)
      .update({ last_message_at: DateTime.utc().minus({ days: 31 }).toJSDate() })
    let result = await client.get('/api/v1/channels/discover?q=discover').loginAs(member)
    result.assertStatus(200)
    assert.deepEqual(
      result.body().data.map((row: { id: number }) => row.id),
      [pub.id]
    )
    await service.join(member.id, pub.name)
    await service.kick(pub.id, admin.id, member.nickname)
    result = await client.get('/api/v1/channels/discover?q=discover').loginAs(member)
    result.assertStatus(200)
    assert.lengthOf(result.body().data, 0)
  })

  test('registration normalizes names, protects credentials and supports login/logout', async ({
    client,
    assert,
  }) => {
    const response = await client.post('/api/v1/auth/signup').json({
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      nickname: ' ADA ',
      email: ' ADA@EXAMPLE.COM ',
      password: 'test-password',
      passwordConfirmation: 'test-password',
    })
    response.assertStatus(200)
    const { user: account, token } = response.body().data
    assert.equal(account.nickname, 'ada')
    assert.equal(account.firstName, 'Ada')
    assert.notProperty(account, 'password')
    const storedAccount = await db.from('users').where('id', account.id).first()
    assert.notEqual(storedAccount.password, 'test-password')
    const profile = await client.get('/api/v1/account/profile').bearerToken(token)
    profile.assertStatus(200)
    const duplicate = await client.post('/api/v1/auth/signup').json({
      firstName: 'Other',
      lastName: 'Person',
      nickname: 'ADA',
      email: 'other@example.com',
      password: 'test-password',
      passwordConfirmation: 'test-password',
    })
    duplicate.assertStatus(422)
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'ADA@EXAMPLE.COM', password: 'test-password' })
    login.assertStatus(200)
    const logout = await client.post('/api/v1/account/logout').bearerToken(token)
    logout.assertStatus(200)
    const rejected = await client.get('/api/v1/account/profile').bearerToken(token)
    rejected.assertStatus(401)
  })

  test('unauthenticated requests and invalid commands are rejected', async ({ client }) => {
    const anonymous = await client.get('/api/v1/channels')
    anonymous.assertStatus(401)
    const actor = await user()
    const syntax = await client
      .post('/api/v1/commands')
      .loginAs(actor)
      .json({ command: '/join alpha public extra' })
    syntax.assertStatus(422)
    const invalid = await client
      .post('/api/v1/channels')
      .loginAs(actor)
      .json({ name: 'bad name', type: 'public' })
    invalid.assertStatus(422)
  })

  test('private channels require invitations and only administrators can invite/revoke', async ({
    assert,
  }) => {
    const service = new ChannelService()
    const admin = await user()
    const member = await user()
    const outsider = await user()
    const channel = await service.create(admin.id, { name: 'private-room', type: 'private' })
    await assert.rejects(() => service.join(outsider.id, channel.name), 'An invitation is required')
    await assert.rejects(
      () => service.members(channel.id, outsider.id),
      'Channel membership required'
    )
    await service.invite(channel.id, admin.id, member.nickname)
    await assert.rejects(
      () => service.invite(channel.id, member.id, outsider.nickname),
      'Channel administrator required'
    )
    const list = await service.list(member.id)
    assert.isFalse(!!list[0].invitation_seen)
    await service.seen(channel.id, member.id)
    const seenList = await service.list(member.id)
    assert.isTrue(!!seenList[0].invitation_seen)
    await service.revoke(channel.id, admin.id, member.nickname)
    await assert.rejects(
      () => service.members(channel.id, member.id),
      'Channel membership required'
    )
  })

  test('three distinct votes ban, duplicates do not count, only administrator restores access', async ({
    assert,
  }) => {
    const service = new ChannelService()
    const admin = await user()
    const target = await user()
    const a = await user()
    const b = await user()
    const c = await user()
    const channel = await service.create(admin.id, { name: 'voting-room', type: 'public' })
    for (const member of [target, a, b, c]) await service.join(member.id, channel.name)
    assert.deepEqual(await service.kick(channel.id, a.id, target.nickname), {
      banned: false,
      votes: 1,
    })
    assert.deepEqual(await service.kick(channel.id, a.id, target.nickname), {
      banned: false,
      votes: 1,
    })
    await service.kick(channel.id, b.id, target.nickname)
    const thirdKick = await service.kick(channel.id, c.id, target.nickname)
    assert.isTrue(thirdKick.banned)
    await assert.rejects(() => service.join(target.id, channel.name), /You are banned/)
    await assert.rejects(
      () => service.invite(channel.id, a.id, target.nickname),
      'Channel administrator required'
    )
    await assert.rejects(
      () => service.members(channel.id, target.id),
      'Channel membership required'
    )
    const restored = await service.invite(channel.id, admin.id, target.nickname)
    assert.isTrue(restored.restored)
    assert.lengthOf(await db.from('kick_votes').where('channel_id', channel.id), 0)
    assert.deepEqual(await service.kick(channel.id, a.id, target.nickname), {
      banned: false,
      votes: 1,
    })
  })

  test('administrator kick is immediate and protected members cannot be targeted', async ({
    assert,
  }) => {
    const service = new ChannelService()
    const admin = await user()
    const member = await user()
    const channel = await service.join(admin.id, 'admin-room')
    await service.join(member.id, channel.name)
    await assert.rejects(
      () => service.kick(channel.id, member.id, admin.nickname),
      /Cannot moderate/
    )
    await assert.rejects(
      () => service.kick(channel.id, member.id, member.nickname),
      /Cannot moderate/
    )
    const adminKick = await service.kick(channel.id, admin.id, member.nickname)
    assert.isTrue(adminKick.banned)
  })

  test('ordinary leaving preserves channel; administrator leaving cascades and releases name', async ({
    assert,
  }) => {
    const service = new ChannelService()
    const admin = await user()
    const member = await user()
    const channel = await service.join(admin.id, 'leave-room')
    await service.join(member.id, channel.name)
    await assert.rejects(
      () => service.leave(channel.id, member.id, true),
      'Channel administrator required'
    )
    const memberLeave = await service.leave(channel.id, member.id)
    assert.isFalse(memberLeave.deleted)
    const adminLeave = await service.leave(channel.id, admin.id)
    assert.isTrue(adminLeave.deleted)
    assert.lengthOf(await db.from('channel_members').where('channel_id', channel.id), 0)
    const recreated = await service.join(member.id, channel.name)
    assert.notEqual(recreated.id, channel.id)
  })

  test('expiration excludes exactly 30 days, commits deletion and releases the name', async ({
    assert,
  }) => {
    const fixedNow = DateTime.fromISO('2026-11-07T12:00:00Z')
    const service = new ChannelService(() => fixedNow)
    const admin = await user()
    const channel = await service.create(admin.id, { name: 'expiry-room', type: 'public' })
    await db
      .from('channels')
      .where('id', channel.id)
      .update({ last_message_at: fixedNow.minus({ days: 30 }).toJSDate() })
    assert.isFalse(await service.expireOne(channel.id))
    await db
      .from('channels')
      .where('id', channel.id)
      .update({ last_message_at: fixedNow.minus({ days: 30, seconds: 1 }).toJSDate() })
    await assert.rejects(
      () => service.members(channel.id, admin.id),
      'Channel not found or expired'
    )
    assert.isNull(await db.from('channels').where('id', channel.id).first())
    const recreated = await service.join(admin.id, channel.name)
    assert.notEqual(recreated.id, channel.id)
  })

  test('failed authorization does not publish membership events', async ({ assert }) => {
    const service = new ChannelService()
    const admin = await user()
    const outsider = await user()
    const channel = await service.join(admin.id, 'events-room', 'private')
    const observed: ChannelEvent[] = []
    const listen = (event: ChannelEvent) => observed.push(event)
    channelEvents.on('change', listen)
    try {
      await assert.rejects(() => service.invite(channel.id, outsider.id, outsider.nickname))
      assert.lengthOf(observed, 0)
      await service.invite(channel.id, admin.id, outsider.nickname)
      assert.deepEqual(observed, [
        { type: 'member.added', channelId: channel.id, userId: outsider.id },
      ])
    } finally {
      channelEvents.off('change', listen)
    }
  })

  test('UI routes and slash commands use the same channel rules', async ({ client, assert }) => {
    const admin = await user()
    const member = await user()
    const created = await client
      .post('/api/v1/commands')
      .loginAs(admin)
      .json({ command: '/join command-room' })
    created.assertStatus(200)
    const createdData = created.body().data
    assert.isFalse(Array.isArray(createdData))
    if (Array.isArray(createdData) || !('id' in createdData))
      throw new Error('Expected channel response')
    const channelId = createdData.id
    const joined = await client
      .post('/api/v1/channels/join')
      .loginAs(member)
      .json({ name: 'COMMAND-ROOM' })
    joined.assertStatus(200)
    assert.equal(joined.body().data.id, channelId)
    const members = await client
      .post('/api/v1/commands')
      .loginAs(member)
      .json({ command: '/list', channelId })
    members.assertStatus(200)
    const memberData = members.body().data
    assert.isArray(memberData)
    if (!Array.isArray(memberData)) throw new Error('Expected member list response')
    assert.lengthOf(memberData, 2)
    const quit = await client
      .post('/api/v1/commands')
      .loginAs(member)
      .json({ command: '/quit', channelId })
    quit.assertStatus(403)
    const removed = await client.delete(`/api/v1/channels/${channelId}`).loginAs(admin)
    removed.assertStatus(200)
  })
})
