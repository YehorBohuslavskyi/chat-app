import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ChannelService from '#services/channel_service'
import MessageService, { mentionedNicknames } from '#services/message_service'
import { DateTime } from 'luxon'

let sequence = 0
async function user() {
  const number = ++sequence
  return User.create({
    firstName: 'Msg',
    lastName: 'Tester',
    fullName: 'Msg Tester',
    nickname: `writer-${number}`,
    email: `writer-${number}@example.com`,
    password: 'test-password',
  })
}

test.group('Messages: sending', (group) => {
  group.setup(() => testUtils.db().migrate())
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('mention parsing matches the frontend rule', ({ assert }) => {
    assert.deepEqual(mentionedNicknames('hi @Ada and @bob-1, mail a@b.c, @@x, @ada again'), [
      'ada',
      'bob-1',
    ])
  })

  test('member sends a message: saved, mentions stored, last_message_at refreshed', async ({
    client,
    assert,
  }) => {
    const service = new ChannelService()
    const admin = await user()
    const member = await user()
    const outsider = await user()
    const channel = await service.create(admin.id, { name: 'talk-room', type: 'public' })
    await service.join(member.id, channel.name)
    await db
      .from('channels')
      .where('id', channel.id)
      .update({ last_message_at: DateTime.utc().minus({ days: 5 }).toJSDate() })

    const response = await client
      .post(`/api/v1/channels/${channel.id}/messages`)
      .loginAs(admin)
      .json({
        body: `  hello @${member.nickname.toUpperCase()}, @${outsider.nickname} and @${admin.nickname}  `,
      })
    response.assertStatus(201)
    const message = response.body().data
    assert.equal(
      message.body,
      `hello @${member.nickname.toUpperCase()}, @${outsider.nickname} and @${admin.nickname}`
    )
    assert.equal(message.sender.nickname, admin.nickname)
    // Only the other channel member counts: outsiders and the sender are not mentions.
    assert.deepEqual(message.mentions, [member.id])

    const stored = await db.from('messages').where('id', message.id).first()
    assert.equal(stored.channel_id, channel.id)
    const mentions = await db.from('message_mentions').where('message_id', message.id)
    assert.deepEqual(
      mentions.map((row) => row.user_id),
      [member.id]
    )
    const refreshed = await db.from('channels').where('id', channel.id).first()
    const lastMessageAt = refreshed.last_message_at
    const millis = lastMessageAt instanceof Date ? lastMessageAt.getTime() : Number(lastMessageAt)
    assert.isAbove(millis, DateTime.utc().minus({ minutes: 1 }).toMillis())
  })

  test('non-members, anonymous users and invalid bodies are rejected', async ({ client }) => {
    const service = new ChannelService()
    const admin = await user()
    const outsider = await user()
    const channel = await service.create(admin.id, { name: 'closed-room', type: 'private' })
    const url = `/api/v1/channels/${channel.id}/messages`

    const anonymous = await client.post(url).json({ body: 'hi' })
    anonymous.assertStatus(401)
    const notMember = await client.post(url).loginAs(outsider).json({ body: 'hi' })
    notMember.assertStatus(403)
    const blank = await client.post(url).loginAs(admin).json({ body: '   ' })
    blank.assertStatus(422)
    const tooLong = await client
      .post(url)
      .loginAs(admin)
      .json({ body: 'x'.repeat(4001) })
    tooLong.assertStatus(422)
    const missing = await client
      .post('/api/v1/channels/999999/messages')
      .loginAs(admin)
      .json({ body: 'hi' })
    missing.assertStatus(404)
  })

  test('history: newest page, older pages, catch-up and member-only access', async ({
    client,
    assert,
  }) => {
    const service = new ChannelService()
    const messages = new MessageService()
    const admin = await user()
    const outsider = await user()
    const channel = await service.create(admin.id, { name: 'history-room', type: 'public' })
    const sent = []
    for (let index = 1; index <= 5; index++)
      sent.push(await messages.send(channel.id, admin.id, `message ${index}`))
    const ids = sent.map((message) => message.id)
    const url = `/api/v1/channels/${channel.id}/messages`

    const newest = await client.get(`${url}?limit=2`).loginAs(admin)
    newest.assertStatus(200)
    assert.deepEqual(
      newest.body().data.items.map((item: { id: number }) => item.id),
      ids.slice(3)
    )
    assert.isTrue(newest.body().data.hasMore)
    assert.equal(newest.body().data.items[0].sender.nickname, admin.nickname)

    const older = await client.get(`${url}?limit=2&before=${ids[3]}`).loginAs(admin)
    assert.deepEqual(
      older.body().data.items.map((item: { id: number }) => item.id),
      ids.slice(1, 3)
    )

    const catchUp = await client.get(`${url}?after=${ids[2]}`).loginAs(admin)
    assert.deepEqual(
      catchUp.body().data.items.map((item: { id: number }) => item.id),
      ids.slice(3)
    )
    assert.isFalse(catchUp.body().data.hasMore)

    const denied = await client.get(url).loginAs(outsider)
    denied.assertStatus(403)
    const both = await client.get(`${url}?before=5&after=1`).loginAs(admin)
    both.assertStatus(422)
  })

  test('deleting a channel deletes its messages and mentions', async ({ assert }) => {
    const service = new ChannelService()
    const admin = await user()
    const member = await user()
    const channel = await service.create(admin.id, { name: 'gone-room', type: 'public' })
    await service.join(member.id, channel.name)
    const sent = await new MessageService().send(channel.id, admin.id, `bye @${member.nickname}`)
    await service.leave(channel.id, admin.id)
    assert.lengthOf(await db.from('messages').where('channel_id', channel.id), 0)
    assert.lengthOf(await db.from('message_mentions').where('message_id', sent.id), 0)
  })
})
